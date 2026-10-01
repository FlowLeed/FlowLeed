-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Notification content
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Related entities
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  interaction_id UUID REFERENCES contact_interactions(id) ON DELETE CASCADE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- State
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "System admins can view all notifications"
ON public.notifications FOR SELECT
USING (public.is_system_admin(auth.uid()));

-- Function to create assignment notifications
CREATE OR REPLACE FUNCTION public.create_assignment_notification(
  _user_id UUID,
  _organization_id UUID,
  _type TEXT,
  _title TEXT,
  _message TEXT,
  _contact_id UUID,
  _pipeline_id UUID,
  _interaction_id UUID DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  -- Only create notification if user_id is not null
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO public.notifications (
    user_id,
    organization_id,
    type,
    title,
    message,
    contact_id,
    pipeline_id,
    interaction_id,
    metadata
  ) VALUES (
    _user_id,
    _organization_id,
    _type,
    _title,
    _message,
    _contact_id,
    _pipeline_id,
    _interaction_id,
    _metadata
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the log_pipeline_contact_activity function to create notifications
CREATE OR REPLACE FUNCTION public.log_pipeline_contact_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  previous_stage_name text;
  new_stage_name text;
  pipeline_name text;
  previous_user_name text;
  new_user_name text;
  fallback_user_id uuid;
  contact_name text;
  org_id uuid;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Get organization ID and contact name
  SELECT organization_id, name INTO org_id, contact_name FROM contacts WHERE id = COALESCE(NEW.contact_id, OLD.contact_id);
  
  -- Get fallback user ID from integration if this is an automated sync
  IF current_user_id IS NULL AND NEW.assigned_to_user_id IS NULL THEN
    SELECT user_id INTO fallback_user_id
    FROM integrations
    WHERE organization_id = org_id
      AND service_name = 'planning_center'
    LIMIT 1;
  END IF;
  
  -- Get pipeline name
  SELECT name INTO pipeline_name FROM pipelines WHERE id = COALESCE(NEW.pipeline_id, OLD.pipeline_id);
  
  -- Handle INSERT (contact added to flow)
  IF TG_OP = 'INSERT' THEN
    -- Get stage name
    SELECT name INTO new_stage_name FROM pipeline_stages WHERE id = NEW.stage_id;
    
    INSERT INTO contact_interactions (
      contact_id,
      pipeline_id,
      stage_id,
      created_by_user_id,
      interaction_type,
      subject,
      details,
      completed_at,
      metadata
    ) VALUES (
      NEW.contact_id,
      NEW.pipeline_id,
      NEW.stage_id,
      COALESCE(current_user_id, NEW.assigned_to_user_id, fallback_user_id),
      'flow_added',
      'Added to ' || pipeline_name,
      'Contact was added to the ' || pipeline_name || ' pipeline in stage: ' || new_stage_name,
      now(),
      jsonb_build_object(
        'pipeline_name', pipeline_name,
        'stage_name', new_stage_name,
        'source_type', NEW.source_type
      )
    );
    
    -- Create notification if someone is assigned (and it's not a self-assignment)
    IF NEW.assigned_to_user_id IS NOT NULL AND NEW.assigned_to_user_id != current_user_id THEN
      PERFORM create_assignment_notification(
        NEW.assigned_to_user_id,
        org_id,
        'person_assigned',
        'New Person Assigned',
        'You have been assigned to ' || COALESCE(contact_name, 'a contact') || ' in ' || pipeline_name,
        NEW.contact_id,
        NEW.pipeline_id,
        NULL,
        jsonb_build_object(
          'pipeline_name', pipeline_name,
          'stage_name', new_stage_name,
          'assigned_by', current_user_id
        )
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Check if stage changed
    IF OLD.stage_id != NEW.stage_id THEN
      -- Get stage names
      SELECT name INTO previous_stage_name FROM pipeline_stages WHERE id = OLD.stage_id;
      SELECT name INTO new_stage_name FROM pipeline_stages WHERE id = NEW.stage_id;
      
      INSERT INTO contact_interactions (
        contact_id,
        pipeline_id,
        stage_id,
        previous_stage_id,
        created_by_user_id,
        interaction_type,
        subject,
        details,
        completed_at,
        metadata
      ) VALUES (
        NEW.contact_id,
        NEW.pipeline_id,
        NEW.stage_id,
        OLD.stage_id,
        COALESCE(current_user_id, NEW.assigned_to_user_id, fallback_user_id),
        'flow_stage_changed',
        'Stage changed in ' || pipeline_name,
        'Moved from "' || previous_stage_name || '" to "' || new_stage_name || '"',
        now(),
        jsonb_build_object(
          'pipeline_name', pipeline_name,
          'previous_stage_name', previous_stage_name,
          'new_stage_name', new_stage_name
        )
      );
    END IF;
    
    -- Check if assignment changed
    IF COALESCE(OLD.assigned_to_user_id::text, '') != COALESCE(NEW.assigned_to_user_id::text, '') THEN
      -- Get user names if available
      IF OLD.assigned_to_user_id IS NOT NULL THEN
        SELECT full_name INTO previous_user_name FROM profiles WHERE user_id = OLD.assigned_to_user_id;
      END IF;
      IF NEW.assigned_to_user_id IS NOT NULL THEN
        SELECT full_name INTO new_user_name FROM profiles WHERE user_id = NEW.assigned_to_user_id;
      END IF;
      
      INSERT INTO contact_interactions (
        contact_id,
        pipeline_id,
        stage_id,
        assigned_to_user_id,
        created_by_user_id,
        interaction_type,
        subject,
        details,
        completed_at,
        metadata
      ) VALUES (
        NEW.contact_id,
        NEW.pipeline_id,
        NEW.stage_id,
        NEW.assigned_to_user_id,
        COALESCE(current_user_id, NEW.assigned_to_user_id, fallback_user_id),
        'flow_assignment_changed',
        'Assignment changed in ' || pipeline_name,
        CASE 
          WHEN OLD.assigned_to_user_id IS NULL THEN 'Assigned to ' || COALESCE(new_user_name, 'Unknown User')
          WHEN NEW.assigned_to_user_id IS NULL THEN 'Unassigned from ' || COALESCE(previous_user_name, 'Unknown User')
          ELSE 'Reassigned from ' || COALESCE(previous_user_name, 'Unknown User') || ' to ' || COALESCE(new_user_name, 'Unknown User')
        END,
        now(),
        jsonb_build_object(
          'pipeline_name', pipeline_name,
          'previous_user_name', previous_user_name,
          'new_user_name', new_user_name
        )
      );
      
      -- Create notifications for assignment changes (skip self-assignments)
      -- Notify new assignee
      IF NEW.assigned_to_user_id IS NOT NULL AND NEW.assigned_to_user_id != current_user_id THEN
        PERFORM create_assignment_notification(
          NEW.assigned_to_user_id,
          org_id,
          'person_assigned',
          'New Person Assigned',
          'You have been assigned to ' || COALESCE(contact_name, 'a contact') || ' in ' || pipeline_name,
          NEW.contact_id,
          NEW.pipeline_id,
          NULL,
          jsonb_build_object(
            'pipeline_name', pipeline_name,
            'assigned_by', current_user_id,
            'previous_assignee', OLD.assigned_to_user_id
          )
        );
      END IF;
      
      -- Notify previous assignee (if being reassigned, not unassigned)
      IF OLD.assigned_to_user_id IS NOT NULL 
         AND OLD.assigned_to_user_id != NEW.assigned_to_user_id 
         AND NEW.assigned_to_user_id IS NOT NULL THEN
        PERFORM create_assignment_notification(
          OLD.assigned_to_user_id,
          org_id,
          'person_unassigned',
          'Person Reassigned',
          COALESCE(contact_name, 'A contact') || ' has been reassigned to ' || 
          COALESCE(new_user_name, 'another team member') || ' in ' || pipeline_name,
          OLD.contact_id,
          OLD.pipeline_id,
          NULL,
          jsonb_build_object(
            'pipeline_name', pipeline_name,
            'reassigned_to', NEW.assigned_to_user_id,
            'reassigned_by', current_user_id
          )
        );
      END IF;
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- Handle DELETE (contact removed from flow)
  IF TG_OP = 'DELETE' THEN
    -- Get stage name
    SELECT name INTO previous_stage_name FROM pipeline_stages WHERE id = OLD.stage_id;
    
    INSERT INTO contact_interactions (
      contact_id,
      pipeline_id,
      stage_id,
      created_by_user_id,
      interaction_type,
      subject,
      details,
      completed_at,
      metadata
    ) VALUES (
      OLD.contact_id,
      OLD.pipeline_id,
      OLD.stage_id,
      COALESCE(current_user_id, OLD.assigned_to_user_id, fallback_user_id),
      'flow_removed',
      'Removed from ' || pipeline_name,
      'Contact was removed from the ' || pipeline_name || ' pipeline (was in stage: ' || previous_stage_name || ')',
      now(),
      jsonb_build_object(
        'pipeline_name', pipeline_name,
        'stage_name', previous_stage_name
      )
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- Update the log_pipeline_contact_activity function to handle automated syncs better
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
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Get fallback user ID from integration if this is an automated sync
  IF current_user_id IS NULL AND NEW.assigned_to_user_id IS NULL THEN
    SELECT user_id INTO fallback_user_id
    FROM integrations
    WHERE organization_id = (SELECT organization_id FROM contacts WHERE id = NEW.contact_id)
      AND service_name = 'planning_center'
    LIMIT 1;
  END IF;
  
  -- Get pipeline name
  SELECT name INTO pipeline_name FROM pipelines WHERE id = NEW.pipeline_id;
  
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
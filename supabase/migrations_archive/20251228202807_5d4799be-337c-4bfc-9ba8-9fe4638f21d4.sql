-- Create table to log all Church Online Platform webhook events
CREATE TABLE public.church_online_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- e.g., 'service.attended', 'moment.interacted', 'prayer.requested'
  event_id TEXT NOT NULL, -- CloudEvents ID for deduplication
  subject TEXT, -- CloudEvents subject (e.g., user ID)
  data JSONB NOT NULL DEFAULT '{}', -- Full event payload
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL, -- Matched contact
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(integration_id, event_id)
);

-- Create indexes for common queries
CREATE INDEX idx_church_online_events_org ON public.church_online_events(organization_id);
CREATE INDEX idx_church_online_events_integration ON public.church_online_events(integration_id);
CREATE INDEX idx_church_online_events_type ON public.church_online_events(event_type);
CREATE INDEX idx_church_online_events_contact ON public.church_online_events(contact_id);
CREATE INDEX idx_church_online_events_created ON public.church_online_events(created_at DESC);

-- Create table for configuring which events trigger which flow actions
CREATE TABLE public.church_online_flow_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- e.g., 'moment.interacted', 'prayer.requested'
  event_filter JSONB DEFAULT '{}', -- Optional filter conditions (e.g., {"momentType": "SALVATION"})
  pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  flow_moment_type_id UUID REFERENCES public.flow_moment_types(id) ON DELETE SET NULL,
  create_contact_if_missing BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_church_online_automations_org ON public.church_online_flow_automations(organization_id);
CREATE INDEX idx_church_online_automations_integration ON public.church_online_flow_automations(integration_id);
CREATE INDEX idx_church_online_automations_event ON public.church_online_flow_automations(event_type);

-- Enable RLS on both tables
ALTER TABLE public.church_online_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_online_flow_automations ENABLE ROW LEVEL SECURITY;

-- RLS policies for church_online_events
CREATE POLICY "Users can view events in their organization"
  ON public.church_online_events
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = church_online_events.organization_id
    AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "System admins can view all events"
  ON public.church_online_events
  FOR SELECT
  USING (is_system_admin(auth.uid()));

-- RLS policies for church_online_flow_automations
CREATE POLICY "Users can view automations in their organization"
  ON public.church_online_flow_automations
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = church_online_flow_automations.organization_id
    AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage automations in their organization"
  ON public.church_online_flow_automations
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = church_online_flow_automations.organization_id
    AND organization_members.user_id = auth.uid()
    AND organization_members.role IN ('owner', 'admin')
  ));

-- Add trigger for updated_at
CREATE TRIGGER update_church_online_events_updated_at
  BEFORE UPDATE ON public.church_online_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_church_online_automations_updated_at
  BEFORE UPDATE ON public.church_online_flow_automations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
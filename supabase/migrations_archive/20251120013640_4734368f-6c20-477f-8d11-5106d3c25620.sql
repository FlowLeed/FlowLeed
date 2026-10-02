-- Create flow_moment_types table
CREATE TABLE IF NOT EXISTS public.flow_moment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('salvation', 'next_step', 'serving', 'group', 'other')),
  weight INTEGER NOT NULL DEFAULT 10,
  description TEXT,
  icon TEXT,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Create pco_moment_mappings table
CREATE TABLE IF NOT EXISTS public.pco_moment_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  pco_source_type TEXT NOT NULL DEFAULT 'custom_tab_field' CHECK (pco_source_type IN ('custom_tab_field', 'group', 'workflow')),
  pco_source_identifier TEXT NOT NULL,
  pco_source_label TEXT NOT NULL,
  pco_tab_name TEXT,
  flow_moment_type_id UUID NOT NULL REFERENCES public.flow_moment_types(id) ON DELETE CASCADE,
  trigger_condition JSONB NOT NULL DEFAULT '{"operator": "equals", "value": "Yes"}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, pco_source_identifier, flow_moment_type_id)
);

-- Create flow_moments table
CREATE TABLE IF NOT EXISTS public.flow_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  flow_moment_type_id UUID NOT NULL REFERENCES public.flow_moment_types(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL DEFAULT 'pco' CHECK (source_system IN ('pco', 'manual', 'form')),
  source_reference TEXT NOT NULL,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id, flow_moment_type_id, source_reference)
);

-- Enable RLS
ALTER TABLE public.flow_moment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pco_moment_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_moments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for flow_moment_types
CREATE POLICY "Users can view moment types in their organization"
  ON public.flow_moment_types FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = flow_moment_types.organization_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can create moment types"
  ON public.flow_moment_types FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = flow_moment_types.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can update moment types"
  ON public.flow_moment_types FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = flow_moment_types.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can delete moment types"
  ON public.flow_moment_types FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = flow_moment_types.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for pco_moment_mappings
CREATE POLICY "Users can view mappings in their organization"
  ON public.pco_moment_mappings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = pco_moment_mappings.organization_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can create mappings"
  ON public.pco_moment_mappings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = pco_moment_mappings.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can update mappings"
  ON public.pco_moment_mappings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = pco_moment_mappings.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can delete mappings"
  ON public.pco_moment_mappings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = pco_moment_mappings.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for flow_moments
CREATE POLICY "Users can view moments for contacts in their organization"
  ON public.flow_moments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = flow_moments.contact_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create moments for contacts in their organization"
  ON public.flow_moments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contacts c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = flow_moments.contact_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update moments for contacts in their organization"
  ON public.flow_moments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = flow_moments.contact_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete moments for contacts in their organization"
  ON public.flow_moments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = flow_moments.contact_id
      AND om.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_flow_moment_types_org ON public.flow_moment_types(organization_id);
CREATE INDEX idx_pco_moment_mappings_org ON public.pco_moment_mappings(organization_id);
CREATE INDEX idx_pco_moment_mappings_integration ON public.pco_moment_mappings(integration_id);
CREATE INDEX idx_flow_moments_contact ON public.flow_moments(contact_id);
CREATE INDEX idx_flow_moments_type ON public.flow_moments(flow_moment_type_id);

-- Triggers for updated_at
CREATE TRIGGER update_flow_moment_types_updated_at
  BEFORE UPDATE ON public.flow_moment_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pco_moment_mappings_updated_at
  BEFORE UPDATE ON public.pco_moment_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_flow_moments_updated_at
  BEFORE UPDATE ON public.flow_moments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default moment types function
CREATE OR REPLACE FUNCTION public.seed_default_moment_types(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.flow_moment_types (organization_id, name, category, weight, description, icon, color) VALUES
    (org_id, 'Salvation Decision', 'salvation', 50, 'Made a decision to follow Christ', 'Heart', '#ef4444'),
    (org_id, 'Baptism', 'next_step', 40, 'Completed baptism', 'Waves', '#06b6d4'),
    (org_id, 'Join the Church', 'next_step', 30, 'Became a church member', 'Church', '#8b5cf6'),
    (org_id, 'Dream Team / Serving', 'serving', 25, 'Started serving on a team', 'Users', '#f59e0b'),
    (org_id, 'Small Group Joined', 'group', 20, 'Joined a small group or community', 'UsersRound', '#10b981'),
    (org_id, 'Fresh Start / Recommitment', 'salvation', 30, 'Recommitted their faith', 'Sparkles', '#ec4899'),
    (org_id, 'Leadership Training', 'serving', 20, 'Participated in leadership development', 'GraduationCap', '#6366f1'),
    (org_id, 'Welcome Party Attended', 'next_step', 15, 'Attended a welcome or connection event', 'PartyPopper', '#eab308')
  ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$;
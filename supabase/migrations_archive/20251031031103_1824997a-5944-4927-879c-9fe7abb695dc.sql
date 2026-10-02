-- Create pipeline_resources table for Flow documentation
CREATE TABLE public.pipeline_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_user_id UUID REFERENCES auth.users(id),
  last_edited_by_user_id UUID REFERENCES auth.users(id),
  UNIQUE(pipeline_id)
);

-- Enable RLS
ALTER TABLE public.pipeline_resources ENABLE ROW LEVEL SECURITY;

-- Users can view resources for flows in their organization
CREATE POLICY "Users can view resources for their organization flows"
  ON public.pipeline_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = pipeline_resources.pipeline_id
        AND om.user_id = auth.uid()
    )
  );

-- Flow leads/managers and org admins can create resources
CREATE POLICY "Flow leads/admins can create resources"
  ON public.pipeline_resources FOR INSERT
  WITH CHECK (
    is_flow_team_member(auth.uid(), pipeline_id)
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = pipeline_resources.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Flow leads/managers and org admins can update resources
CREATE POLICY "Flow leads/admins can update resources"
  ON public.pipeline_resources FOR UPDATE
  USING (
    get_flow_role(auth.uid(), pipeline_id) IN ('lead', 'manager')
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = pipeline_resources.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Flow leads/managers and org admins can delete resources
CREATE POLICY "Flow leads/admins can delete resources"
  ON public.pipeline_resources FOR DELETE
  USING (
    get_flow_role(auth.uid(), pipeline_id) IN ('lead', 'manager')
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = pipeline_resources.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_pipeline_resources_updated_at
  BEFORE UPDATE ON public.pipeline_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_pipeline_resources_pipeline_id ON public.pipeline_resources(pipeline_id);
CREATE INDEX idx_pipeline_resources_organization_id ON public.pipeline_resources(organization_id);
-- Create table to map Planning Center lists to our pipelines/flows
CREATE TABLE public.integration_list_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  external_list_id TEXT NOT NULL,
  external_list_name TEXT NOT NULL,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  auto_sync BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(integration_id, external_list_id)
);

-- Enable RLS
ALTER TABLE public.integration_list_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies for list mappings
CREATE POLICY "Users can view list mappings for their organization integrations" 
ON public.integration_list_mappings 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM integrations i
  JOIN organization_members om ON (om.organization_id = i.organization_id)
  WHERE i.id = integration_list_mappings.integration_id 
  AND om.user_id = auth.uid()
));

CREATE POLICY "Users can create list mappings for their organization integrations" 
ON public.integration_list_mappings 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM integrations i
  JOIN organization_members om ON (om.organization_id = i.organization_id)
  WHERE i.id = integration_list_mappings.integration_id 
  AND om.user_id = auth.uid()
));

CREATE POLICY "Users can update list mappings for their organization integrations" 
ON public.integration_list_mappings 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM integrations i
  JOIN organization_members om ON (om.organization_id = i.organization_id)
  WHERE i.id = integration_list_mappings.integration_id 
  AND om.user_id = auth.uid()
));

CREATE POLICY "Users can delete list mappings for their organization integrations" 
ON public.integration_list_mappings 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM integrations i
  JOIN organization_members om ON (om.organization_id = i.organization_id)
  WHERE i.id = integration_list_mappings.integration_id 
  AND om.user_id = auth.uid()
));

-- Add trigger for updated_at
CREATE TRIGGER update_integration_list_mappings_updated_at
BEFORE UPDATE ON public.integration_list_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
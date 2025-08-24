-- Add Planning Center tracking fields to contacts table
ALTER TABLE public.contacts 
ADD COLUMN pc_person_id TEXT,
ADD COLUMN source_type TEXT DEFAULT 'manual',
ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE;

-- Add source mapping tracking to pipeline_contacts table  
ALTER TABLE public.pipeline_contacts
ADD COLUMN source_type TEXT DEFAULT 'manual',
ADD COLUMN source_id TEXT;

-- Create list metadata caching table for PC lists
CREATE TABLE public.integration_list_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL,
  external_list_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  member_count INTEGER,
  list_type TEXT,
  last_updated_at TIMESTAMP WITH TIME ZONE,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on the new table
ALTER TABLE public.integration_list_metadata ENABLE ROW LEVEL SECURITY;

-- Create policies for list metadata
CREATE POLICY "Users can view list metadata for their organization integrations"
ON public.integration_list_metadata
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM integrations i
  JOIN organization_members om ON om.organization_id = i.organization_id
  WHERE i.id = integration_list_metadata.integration_id 
  AND om.user_id = auth.uid()
));

CREATE POLICY "Users can manage list metadata for their organization integrations"
ON public.integration_list_metadata
FOR ALL
USING (EXISTS (
  SELECT 1 FROM integrations i
  JOIN organization_members om ON om.organization_id = i.organization_id
  WHERE i.id = integration_list_metadata.integration_id 
  AND om.user_id = auth.uid()
));

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_integration_list_metadata_updated_at
BEFORE UPDATE ON public.integration_list_metadata
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_contacts_pc_person_id ON public.contacts(pc_person_id);
CREATE INDEX idx_contacts_source_type ON public.contacts(source_type);
CREATE INDEX idx_pipeline_contacts_source ON public.pipeline_contacts(source_type, source_id);
CREATE INDEX idx_integration_list_metadata_integration_id ON public.integration_list_metadata(integration_id);
CREATE INDEX idx_integration_list_metadata_external_list_id ON public.integration_list_metadata(external_list_id);
-- Create pipelines table
CREATE TABLE public.pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pipeline_stages table
CREATE TABLE public.pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  stage_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  organization_id UUID NOT NULL,
  assigned_to_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contact_tags table for the tags array
CREATE TABLE public.contact_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  tag TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pipeline_contacts table to link contacts to pipeline stages
CREATE TABLE public.pipeline_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL,
  stage_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  stage_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id, pipeline_id)
);

-- Add foreign key constraints
ALTER TABLE public.pipeline_stages 
ADD CONSTRAINT fk_pipeline_stages_pipeline_id 
FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE;

ALTER TABLE public.contact_tags 
ADD CONSTRAINT fk_contact_tags_contact_id 
FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

ALTER TABLE public.pipeline_contacts 
ADD CONSTRAINT fk_pipeline_contacts_pipeline_id 
FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE;

ALTER TABLE public.pipeline_contacts 
ADD CONSTRAINT fk_pipeline_contacts_stage_id 
FOREIGN KEY (stage_id) REFERENCES public.pipeline_stages(id) ON DELETE CASCADE;

ALTER TABLE public.pipeline_contacts 
ADD CONSTRAINT fk_pipeline_contacts_contact_id 
FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_contacts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for pipelines
CREATE POLICY "Users can view pipelines in their organization" 
ON public.pipelines 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM organization_members 
  WHERE organization_members.organization_id = pipelines.organization_id 
  AND organization_members.user_id = auth.uid()
));

CREATE POLICY "Users can create pipelines in their organization" 
ON public.pipelines 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM organization_members 
  WHERE organization_members.organization_id = pipelines.organization_id 
  AND organization_members.user_id = auth.uid()
));

CREATE POLICY "Users can update pipelines in their organization" 
ON public.pipelines 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM organization_members 
  WHERE organization_members.organization_id = pipelines.organization_id 
  AND organization_members.user_id = auth.uid()
));

CREATE POLICY "Users can delete pipelines in their organization" 
ON public.pipelines 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM organization_members 
  WHERE organization_members.organization_id = pipelines.organization_id 
  AND organization_members.user_id = auth.uid()
));

-- Create RLS policies for pipeline_stages
CREATE POLICY "Users can view stages of pipelines in their organization" 
ON public.pipeline_stages 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM pipelines p
  JOIN organization_members om ON om.organization_id = p.organization_id
  WHERE p.id = pipeline_stages.pipeline_id 
  AND om.user_id = auth.uid()
));

CREATE POLICY "Users can create stages for pipelines in their organization" 
ON public.pipeline_stages 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM pipelines p
  JOIN organization_members om ON om.organization_id = p.organization_id
  WHERE p.id = pipeline_stages.pipeline_id 
  AND om.user_id = auth.uid()
));

CREATE POLICY "Users can update stages of pipelines in their organization" 
ON public.pipeline_stages 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM pipelines p
  JOIN organization_members om ON om.organization_id = p.organization_id
  WHERE p.id = pipeline_stages.pipeline_id 
  AND om.user_id = auth.uid()
));

CREATE POLICY "Users can delete stages of pipelines in their organization" 
ON public.pipeline_stages 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM pipelines p
  JOIN organization_members om ON om.organization_id = p.organization_id
  WHERE p.id = pipeline_stages.pipeline_id 
  AND om.user_id = auth.uid()
));

-- Create RLS policies for contacts
CREATE POLICY "Users can view contacts in their organization" 
ON public.contacts 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM organization_members 
  WHERE organization_members.organization_id = contacts.organization_id 
  AND organization_members.user_id = auth.uid()
));

CREATE POLICY "Users can create contacts in their organization" 
ON public.contacts 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM organization_members 
  WHERE organization_members.organization_id = contacts.organization_id 
  AND organization_members.user_id = auth.uid()
));

CREATE POLICY "Users can update contacts in their organization" 
ON public.contacts 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM organization_members 
  WHERE organization_members.organization_id = contacts.organization_id 
  AND organization_members.user_id = auth.uid()
));

CREATE POLICY "Users can delete contacts in their organization" 
ON public.contacts 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM organization_members 
  WHERE organization_members.organization_id = contacts.organization_id 
  AND organization_members.user_id = auth.uid()
));

-- Create RLS policies for contact_tags
CREATE POLICY "Users can view contact tags in their organization" 
ON public.contact_tags 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_tags.contact_id 
  AND om.user_id = auth.uid()
));

CREATE POLICY "Users can create contact tags in their organization" 
ON public.contact_tags 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_tags.contact_id 
  AND om.user_id = auth.uid()
));

CREATE POLICY "Users can update contact tags in their organization" 
ON public.contact_tags 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_tags.contact_id 
  AND om.user_id = auth.uid()
));

CREATE POLICY "Users can delete contact tags in their organization" 
ON public.contact_tags 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_tags.contact_id 
  AND om.user_id = auth.uid()
));

-- Create RLS policies for pipeline_contacts
CREATE POLICY "Users can view pipeline contacts in their organization" 
ON public.pipeline_contacts 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM pipelines p
  JOIN organization_members om ON om.organization_id = p.organization_id
  WHERE p.id = pipeline_contacts.pipeline_id 
  AND om.user_id = auth.uid()
));

CREATE POLICY "Users can create pipeline contacts in their organization" 
ON public.pipeline_contacts 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM pipelines p
  JOIN organization_members om ON om.organization_id = p.organization_id
  WHERE p.id = pipeline_contacts.pipeline_id 
  AND om.user_id = auth.uid()
));

CREATE POLICY "Users can update pipeline contacts in their organization" 
ON public.pipeline_contacts 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM pipelines p
  JOIN organization_members om ON om.organization_id = p.organization_id
  WHERE p.id = pipeline_contacts.pipeline_id 
  AND om.user_id = auth.uid()
));

CREATE POLICY "Users can delete pipeline contacts in their organization" 
ON public.pipeline_contacts 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM pipelines p
  JOIN organization_members om ON om.organization_id = p.organization_id
  WHERE p.id = pipeline_contacts.pipeline_id 
  AND om.user_id = auth.uid()
));

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_pipelines_updated_at
BEFORE UPDATE ON public.pipelines
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pipeline_stages_updated_at
BEFORE UPDATE ON public.pipeline_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pipeline_contacts_updated_at
BEFORE UPDATE ON public.pipeline_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Create integrations table to store user integration credentials and settings
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}',
  settings JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, service_name)
);

-- Enable Row Level Security
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Create policies for integrations
CREATE POLICY "Users can view integrations in their organization" 
ON public.integrations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM organization_members om 
  WHERE om.organization_id = integrations.organization_id 
  AND om.user_id = auth.uid()
));

CREATE POLICY "Users can create integrations in their organization" 
ON public.integrations 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = integrations.organization_id 
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own integrations" 
ON public.integrations 
FOR UPDATE 
USING (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = integrations.organization_id 
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own integrations" 
ON public.integrations 
FOR DELETE 
USING (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = integrations.organization_id 
    AND om.user_id = auth.uid()
  )
);

-- Create integration_logs table for tracking sync activities
CREATE TABLE public.integration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for integration_logs
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for integration logs
CREATE POLICY "Users can view logs for their integrations" 
ON public.integration_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM integrations i
  JOIN organization_members om ON (om.organization_id = i.organization_id)
  WHERE i.id = integration_logs.integration_id 
  AND om.user_id = auth.uid()
));

-- Create trigger for updating updated_at column
CREATE TRIGGER update_integrations_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Add flow_order column to pipelines table for custom ordering in sidebar
ALTER TABLE public.pipelines 
ADD COLUMN IF NOT EXISTS flow_order INTEGER DEFAULT 0;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_pipelines_organization_order 
ON public.pipelines(organization_id, flow_order);
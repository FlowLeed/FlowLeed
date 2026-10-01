-- Add completion_moment_type_id to pipelines table
ALTER TABLE public.pipelines 
ADD COLUMN completion_moment_type_id uuid REFERENCES public.flow_moment_types(id) ON DELETE SET NULL;
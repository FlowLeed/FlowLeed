-- Add per-flow role assignments to invitations
ALTER TABLE public.invitations 
ADD COLUMN IF NOT EXISTS pipeline_assignments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.invitations.pipeline_assignments IS 'Array of {pipeline_id, role} objects to add the user to flows on accept';
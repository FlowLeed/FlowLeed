-- Add assigned_to_user_id column to pipeline_contacts table for per-flow assignments
ALTER TABLE public.pipeline_contacts 
ADD COLUMN assigned_to_user_id UUID REFERENCES auth.users(id);

-- Add an index for better performance on assignment queries
CREATE INDEX idx_pipeline_contacts_assigned_to_user_id 
ON public.pipeline_contacts(assigned_to_user_id);

-- Update the trigger to ensure proper timestamps
CREATE OR REPLACE FUNCTION public.update_pipeline_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for updated_at if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_pipeline_contacts_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_pipeline_contacts_updated_at_trigger
      BEFORE UPDATE ON public.pipeline_contacts
      FOR EACH ROW
      EXECUTE FUNCTION public.update_pipeline_contacts_updated_at();
  END IF;
END $$;
-- Add order column to integration_list_mappings for reordering
ALTER TABLE public.integration_list_mappings 
ADD COLUMN display_order integer NOT NULL DEFAULT 0;

-- Create index for efficient ordering
CREATE INDEX idx_integration_list_mappings_order ON public.integration_list_mappings(integration_id, display_order);

-- Add start/end step markers to pipeline_stages
ALTER TABLE public.pipeline_stages 
ADD COLUMN is_start_step boolean NOT NULL DEFAULT false,
ADD COLUMN is_end_step boolean NOT NULL DEFAULT false;

-- Add progress tracking timestamps to pipeline_contacts
ALTER TABLE public.pipeline_contacts 
ADD COLUMN entered_start_at timestamp with time zone,
ADD COLUMN completed_end_at timestamp with time zone;

-- Create function to automatically set progress timestamps
CREATE OR REPLACE FUNCTION public.update_pipeline_contact_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- If moving to a start step, set entered_start_at
  IF EXISTS (
    SELECT 1 FROM public.pipeline_stages 
    WHERE id = NEW.stage_id AND is_start_step = true
  ) THEN
    NEW.entered_start_at = COALESCE(OLD.entered_start_at, now());
  END IF;
  
  -- If moving to an end step, set completed_end_at
  IF EXISTS (
    SELECT 1 FROM public.pipeline_stages 
    WHERE id = NEW.stage_id AND is_end_step = true
  ) THEN
    NEW.completed_end_at = now();
  END IF;
  
  -- If moving away from end step, clear completed_end_at
  IF OLD.stage_id IS NOT NULL AND NEW.stage_id != OLD.stage_id AND EXISTS (
    SELECT 1 FROM public.pipeline_stages 
    WHERE id = OLD.stage_id AND is_end_step = true
  ) THEN
    NEW.completed_end_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic progress tracking
CREATE TRIGGER update_pipeline_contact_progress_trigger
  BEFORE UPDATE ON public.pipeline_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pipeline_contact_progress();

-- Create trigger for new pipeline contacts
CREATE TRIGGER insert_pipeline_contact_progress_trigger
  BEFORE INSERT ON public.pipeline_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pipeline_contact_progress();
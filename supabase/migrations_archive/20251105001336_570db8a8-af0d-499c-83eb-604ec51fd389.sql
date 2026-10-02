-- Add stage_entered_at column to pipeline_contacts table
ALTER TABLE pipeline_contacts 
ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ DEFAULT now();

-- Backfill existing records with their created_at timestamp
UPDATE pipeline_contacts 
SET stage_entered_at = created_at 
WHERE stage_entered_at IS NULL;

-- Create trigger function to update stage_entered_at when stage changes
CREATE OR REPLACE FUNCTION update_stage_entered_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update stage_entered_at if stage_id has actually changed
  IF (TG_OP = 'UPDATE' AND OLD.stage_id IS DISTINCT FROM NEW.stage_id) THEN
    NEW.stage_entered_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on pipeline_contacts
DROP TRIGGER IF EXISTS trigger_update_stage_entered_at ON pipeline_contacts;
CREATE TRIGGER trigger_update_stage_entered_at
  BEFORE UPDATE ON pipeline_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_stage_entered_at();
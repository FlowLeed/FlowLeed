-- Add default_assignee_user_id column to pipeline_stages
ALTER TABLE public.pipeline_stages
ADD COLUMN default_assignee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_pipeline_stages_default_assignee 
ON public.pipeline_stages(default_assignee_user_id) 
WHERE default_assignee_user_id IS NOT NULL;

-- Create validation function
CREATE OR REPLACE FUNCTION validate_stage_assignee()
RETURNS trigger AS $$
BEGIN
  -- If default_assignee_user_id is set, verify they have flow access
  IF NEW.default_assignee_user_id IS NOT NULL THEN
    IF NOT is_flow_team_member(NEW.default_assignee_user_id, NEW.pipeline_id) THEN
      RAISE EXCEPTION 'User must be a team member of this flow to be set as default assignee';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for validation
CREATE TRIGGER validate_stage_assignee_trigger
BEFORE INSERT OR UPDATE ON public.pipeline_stages
FOR EACH ROW
EXECUTE FUNCTION validate_stage_assignee();

-- Create cleanup trigger for removed team members
CREATE OR REPLACE FUNCTION cleanup_stage_assignees()
RETURNS trigger AS $$
BEGIN
  -- When a team member is removed, clear them from stage default assignees
  UPDATE public.pipeline_stages
  SET default_assignee_user_id = NULL
  WHERE pipeline_id = OLD.pipeline_id
    AND default_assignee_user_id = OLD.user_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER cleanup_stage_assignees_trigger
AFTER DELETE ON public.pipeline_team_members
FOR EACH ROW
EXECUTE FUNCTION cleanup_stage_assignees();
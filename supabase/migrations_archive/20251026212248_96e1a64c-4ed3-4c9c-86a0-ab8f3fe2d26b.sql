-- Function to cleanup pipeline team members when user leaves organization
CREATE OR REPLACE FUNCTION public.cleanup_pipeline_team_on_org_leave()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a user is removed from an organization,
  -- remove them from all pipeline teams in that organization
  DELETE FROM public.pipeline_team_members ptm
  WHERE ptm.user_id = OLD.user_id
    AND ptm.pipeline_id IN (
      SELECT id FROM public.pipelines
      WHERE organization_id = OLD.organization_id
    );
  
  RETURN OLD;
END;
$$;

-- Trigger to run cleanup before user is removed from organization
CREATE TRIGGER on_org_member_removed
  BEFORE DELETE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_pipeline_team_on_org_leave();

-- One-time cleanup: Remove existing orphaned pipeline team member record
DELETE FROM public.pipeline_team_members 
WHERE id = '54ba1c60-4c84-4afe-8b65-c4a86ee91695';
-- 1) Create trigger to add pipeline creator as lead team member
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_add_pipeline_creator_as_owner'
  ) THEN
    CREATE TRIGGER trg_add_pipeline_creator_as_owner
    AFTER INSERT ON public.pipelines
    FOR EACH ROW
    EXECUTE FUNCTION public.add_pipeline_creator_as_owner();
  END IF;
END $$;

-- 2) Backfill missing profiles from auth.users (no changes to auth schema)
INSERT INTO public.profiles (user_id, email, full_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

-- 3) Backfill pipeline_team_members so org owners/admins can access existing pipelines
INSERT INTO public.pipeline_team_members (pipeline_id, user_id, role)
SELECT p.id, om.user_id,
  CASE WHEN om.role = 'owner' THEN 'lead' ELSE 'manager' END
FROM public.pipelines p
JOIN public.organization_members om ON om.organization_id = p.organization_id
WHERE om.role IN ('owner','admin')
  AND NOT EXISTS (
    SELECT 1 FROM public.pipeline_team_members ptm
    WHERE ptm.pipeline_id = p.id AND ptm.user_id = om.user_id
  );
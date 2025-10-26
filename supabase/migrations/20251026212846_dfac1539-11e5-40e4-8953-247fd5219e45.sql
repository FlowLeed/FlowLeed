-- Comprehensive cleanup: Remove ALL existing orphaned pipeline team member records
-- This finds team members who are no longer part of the organization that owns the pipeline
DELETE FROM public.pipeline_team_members ptm
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.organization_members om
  JOIN public.pipelines p ON p.organization_id = om.organization_id
  WHERE om.user_id = ptm.user_id
    AND p.id = ptm.pipeline_id
);
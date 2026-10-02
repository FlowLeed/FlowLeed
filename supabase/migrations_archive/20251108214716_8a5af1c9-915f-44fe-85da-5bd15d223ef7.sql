-- Normalize onboarding_progress schema for all organizations
-- Add missing fields and auto-detect completed steps

-- First, update all organizations to have the correct schema
UPDATE organizations
SET onboarding_progress = jsonb_build_object(
  'first_flow_created', COALESCE((onboarding_progress->>'first_flow_created')::boolean, 
    EXISTS(SELECT 1 FROM pipelines WHERE organization_id = organizations.id LIMIT 1)),
  'pco_connected', COALESCE((onboarding_progress->>'pco_connected')::boolean,
    EXISTS(SELECT 1 FROM integrations WHERE organization_id = organizations.id AND service_name = 'planning_center' AND status = 'active' LIMIT 1)),
  'pco_lists_mapped', COALESCE((onboarding_progress->>'pco_lists_mapped')::boolean,
    EXISTS(SELECT 1 FROM integration_list_mappings ilm 
           JOIN integrations i ON i.id = ilm.integration_id 
           WHERE i.organization_id = organizations.id LIMIT 1)),
  'team_members_invited', COALESCE(
    (onboarding_progress->>'team_members_invited')::boolean,
    (onboarding_progress->>'team_invited')::boolean,
    (SELECT COUNT(*) FROM organization_members WHERE organization_id = organizations.id) > 1),
  'flow_owners_assigned', COALESCE((onboarding_progress->>'flow_owners_assigned')::boolean,
    EXISTS(SELECT 1 FROM pipeline_team_members ptm 
           JOIN pipelines p ON p.id = ptm.pipeline_id 
           WHERE p.organization_id = organizations.id LIMIT 1))
)
WHERE onboarding_progress IS NOT NULL;
-- Ensure the trigger exists to create default pipelines on org creation
-- This is idempotent - will recreate if needed
DROP TRIGGER IF EXISTS create_default_pipelines_trigger ON organization_members;

CREATE TRIGGER create_default_pipelines_trigger
  AFTER INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_default_pipelines();

-- Backfill: Add default flows to any organizations that currently have zero pipelines
DO $$
DECLARE
  org_record RECORD;
  pipeline_count INTEGER;
BEGIN
  -- Loop through all organizations
  FOR org_record IN 
    SELECT DISTINCT o.id, o.name
    FROM organizations o
    WHERE NOT EXISTS (
      SELECT 1 FROM pipelines p WHERE p.organization_id = o.id
    )
  LOOP
    -- Double-check this org really has no pipelines
    SELECT COUNT(*) INTO pipeline_count
    FROM pipelines
    WHERE organization_id = org_record.id;
    
    IF pipeline_count = 0 THEN
      RAISE NOTICE 'Creating default flows for organization: % (%)', org_record.name, org_record.id;
      PERFORM public.create_default_pipelines(org_record.id);
    END IF;
  END LOOP;
END $$;
-- Fix default pipeline creation by moving trigger to organization_members
-- This ensures pipelines are created AFTER the owner membership exists

-- 1. Drop the old trigger that was firing too early
DROP TRIGGER IF EXISTS after_organization_insert ON public.organizations;

-- 2. Update the trigger function to be called from organization_members instead
CREATE OR REPLACE FUNCTION public.trigger_create_default_pipelines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only create defaults if this is an owner/admin being added
  -- and the organization has no pipelines yet
  IF NEW.role IN ('owner', 'admin') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE organization_id = NEW.organization_id
      LIMIT 1
    ) THEN
      PERFORM public.create_default_pipelines(NEW.organization_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Create the new trigger on organization_members
DROP TRIGGER IF EXISTS after_owner_member_insert ON public.organization_members;
CREATE TRIGGER after_owner_member_insert
  AFTER INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_default_pipelines();

-- 4. Backfill missing defaults for existing organizations
DO $$
DECLARE
  org_record RECORD;
  pipeline_count INTEGER;
BEGIN
  FOR org_record IN
    SELECT o.id AS org_id, o.name AS org_name
    FROM public.organizations o
    LEFT JOIN public.pipelines p ON p.organization_id = o.id
    GROUP BY o.id, o.name
    HAVING COUNT(p.id) = 0
  LOOP
    BEGIN
      RAISE NOTICE 'Creating default pipelines for org: % (%)', org_record.org_name, org_record.org_id;
      PERFORM public.create_default_pipelines(org_record.org_id);
      
      -- Verify pipelines were created
      SELECT COUNT(*) INTO pipeline_count
      FROM public.pipelines
      WHERE organization_id = org_record.org_id;
      
      RAISE NOTICE 'Created % pipelines for org: %', pipeline_count, org_record.org_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create default pipelines for org % (%): %', 
        org_record.org_name, org_record.org_id, SQLERRM;
    END;
  END LOOP;
END $$;
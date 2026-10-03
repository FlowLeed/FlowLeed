CREATE OR REPLACE FUNCTION public.restore_default_flows_after_demo_clear()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.demo_cleared_at IS NOT NULL
     AND (OLD.demo_cleared_at IS DISTINCT FROM NEW.demo_cleared_at)
     AND NOT EXISTS (SELECT 1 FROM public.pipelines WHERE organization_id = NEW.id) THEN
    PERFORM public.create_default_pipelines(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_default_flows_after_demo_clear ON public.organizations;
CREATE TRIGGER trg_restore_default_flows_after_demo_clear
AFTER UPDATE OF demo_cleared_at ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.restore_default_flows_after_demo_clear();

-- Backfill: churches that cleared sample data and were left with no flows
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT o.id FROM public.organizations o
           WHERE o.demo_cleared_at IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM public.pipelines p WHERE p.organization_id = o.id)
  LOOP
    PERFORM public.create_default_pipelines(r.id);
  END LOOP;
END $$;
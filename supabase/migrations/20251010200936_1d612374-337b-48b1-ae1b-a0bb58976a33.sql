-- Make add_pipeline_creator_as_owner idempotent and ensure single trigger

-- 1) Update function to avoid duplicate inserts
CREATE OR REPLACE FUNCTION public.add_pipeline_creator_as_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.pipeline_team_members (pipeline_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'lead')
  ON CONFLICT (pipeline_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 2) Drop legacy/duplicate trigger if present and ensure only one trigger exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'after_pipeline_insert') THEN
    DROP TRIGGER after_pipeline_insert ON public.pipelines;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_add_pipeline_creator_as_owner') THEN
    CREATE TRIGGER trg_add_pipeline_creator_as_owner
    AFTER INSERT ON public.pipelines
    FOR EACH ROW
    EXECUTE FUNCTION public.add_pipeline_creator_as_owner();
  END IF;
END $$;
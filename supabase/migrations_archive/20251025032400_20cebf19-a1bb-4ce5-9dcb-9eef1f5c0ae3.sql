-- Fix search_path security warning for trigger function
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
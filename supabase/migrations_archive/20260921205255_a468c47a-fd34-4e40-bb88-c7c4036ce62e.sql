ALTER FUNCTION public.recompute_contact_markers(uuid) RENAME TO recompute_contact_markers_core;

CREATE OR REPLACE FUNCTION public.recompute_contact_markers(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.recompute_contact_markers_core(p_org_id);

  -- People in an active life season are excluded from signals
  DELETE FROM public.contact_markers cm
  WHERE cm.organization_id = p_org_id
    AND EXISTS (
      SELECT 1 FROM public.contact_life_seasons ls
      WHERE ls.contact_id = cm.contact_id
        AND ls.ended_on IS NULL
    );
END;
$function$;
CREATE OR REPLACE FUNCTION public.admin_delete_organization(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only system administrators can delete organizations';
  END IF;

  -- Delete from tables that reference organizations without ON DELETE CASCADE
  DELETE FROM public.user_pco_visible_people WHERE organization_id = _org_id;
  DELETE FROM public.user_pco_field_preferences WHERE organization_id = _org_id;
  DELETE FROM public.user_pco_connections WHERE organization_id = _org_id;
  DELETE FROM public.pco_oauth_states WHERE organization_id = _org_id;
  DELETE FROM public.integrations WHERE organization_id = _org_id;
  DELETE FROM public.pipelines WHERE organization_id = _org_id;
  DELETE FROM public.contacts WHERE organization_id = _org_id;

  -- Remaining tables cascade via FK ON DELETE CASCADE
  DELETE FROM public.organizations WHERE id = _org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_organization(uuid) TO authenticated;
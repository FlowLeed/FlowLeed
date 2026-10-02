CREATE OR REPLACE FUNCTION public.get_public_group_settings(p_org_id uuid)
RETURNS TABLE (
  directory_hero_title text,
  directory_hero_subtitle text,
  directory_show_meeting_time boolean,
  directory_show_location boolean,
  directory_show_capacity boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT directory_hero_title, directory_hero_subtitle,
         directory_show_meeting_time, directory_show_location, directory_show_capacity
  FROM public.group_settings
  WHERE organization_id = p_org_id AND directory_enabled = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_group_settings(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_group_types(p_org_id uuid)
RETURNS TABLE (
  key text,
  label text,
  icon text,
  color text,
  sort_order integer,
  is_active boolean,
  is_hidden boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.key, t.label, t.icon, t.color, t.sort_order, t.is_active, t.is_hidden
  FROM public.group_type_definitions t
  WHERE t.organization_id = p_org_id
    AND EXISTS (
      SELECT 1 FROM public.group_settings s
      WHERE s.organization_id = p_org_id AND s.directory_enabled = true
    )
  ORDER BY t.sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_group_types(uuid) TO anon, authenticated;
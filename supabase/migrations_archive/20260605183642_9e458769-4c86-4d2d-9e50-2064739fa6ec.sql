CREATE OR REPLACE FUNCTION public.search_visible_contacts(
  _organization_id uuid,
  _search_term text,
  _limit integer DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  phone text,
  avatar text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH caller AS (
    SELECT auth.uid() AS user_id
  ), normalized AS (
    SELECT
      trim(COALESCE(_search_term, '')) AS term,
      regexp_replace(COALESCE(_search_term, ''), '\\D', '', 'g') AS digits,
      LEAST(GREATEST(COALESCE(_limit, 8), 1), 25) AS result_limit
  )
  SELECT
    c.id,
    c.name,
    c.email,
    c.phone,
    c.avatar
  FROM public.contacts c
  CROSS JOIN caller
  CROSS JOIN normalized n
  WHERE c.organization_id = _organization_id
    AND n.term <> ''
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = c.organization_id
        AND om.user_id = caller.user_id
    )
    AND (
      c.name ILIKE ('%' || n.term || '%')
      OR c.email ILIKE ('%' || n.term || '%')
      OR (
        length(n.digits) >= 3
        AND regexp_replace(COALESCE(c.phone, ''), '\\D', '', 'g') ILIKE ('%' || n.digits || '%')
      )
    )
    AND (
      NOT COALESCE((
        SELECT o.pco_enforce_user_permissions
        FROM public.organizations o
        WHERE o.id = c.organization_id
      ), false)
      OR EXISTS (
        SELECT 1
        FROM public.organization_members om_admin
        WHERE om_admin.organization_id = c.organization_id
          AND om_admin.user_id = caller.user_id
          AND om_admin.role IN ('owner', 'admin')
      )
      OR c.pc_person_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.user_pco_connections upc
        WHERE upc.user_id = caller.user_id
          AND upc.organization_id = c.organization_id
          AND upc.status = 'active'
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_pco_visible_people v
        WHERE v.user_id = caller.user_id
          AND v.organization_id = c.organization_id
          AND v.pc_person_id = c.pc_person_id
      )
    )
  ORDER BY
    CASE WHEN c.name ILIKE (n.term || '%') THEN 0 ELSE 1 END,
    c.name ASC
  LIMIT (SELECT result_limit FROM normalized);
$$;

GRANT EXECUTE ON FUNCTION public.search_visible_contacts(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_visible_contacts(uuid, text, integer) TO service_role;
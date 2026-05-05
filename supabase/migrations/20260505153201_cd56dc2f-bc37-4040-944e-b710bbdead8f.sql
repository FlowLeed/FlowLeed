CREATE OR REPLACE FUNCTION public.get_org_team_activity_stats(p_org_id uuid)
RETURNS TABLE(
  user_id uuid,
  last_active_at timestamptz,
  active_days_30d integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auth: caller must be a member of the org or a system admin
  IF NOT (
    public.is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = p_org_id AND user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH members AS (
    SELECT om.user_id
    FROM public.organization_members om
    WHERE om.organization_id = p_org_id
  ),
  activity AS (
    -- Logins
    SELECT ul.user_id, ul.logged_in_at AS ts
    FROM public.user_logins ul
    WHERE ul.organization_id = p_org_id
      AND ul.logged_in_at >= NOW() - INTERVAL '30 days'
    UNION ALL
    -- Interactions (filtered to this org via contacts join)
    SELECT ci.created_by_user_id AS user_id, ci.created_at AS ts
    FROM public.contact_interactions ci
    JOIN public.contacts c ON c.id = ci.contact_id
    WHERE c.organization_id = p_org_id
      AND ci.created_at >= NOW() - INTERVAL '30 days'
  ),
  last_login AS (
    SELECT ul.user_id, MAX(ul.logged_in_at) AS ts
    FROM public.user_logins ul
    WHERE ul.organization_id = p_org_id
    GROUP BY ul.user_id
  ),
  last_interaction AS (
    SELECT ci.created_by_user_id AS user_id, MAX(ci.created_at) AS ts
    FROM public.contact_interactions ci
    JOIN public.contacts c ON c.id = ci.contact_id
    WHERE c.organization_id = p_org_id
    GROUP BY ci.created_by_user_id
  )
  SELECT
    m.user_id,
    GREATEST(
      COALESCE(ll.ts, 'epoch'::timestamptz),
      COALESCE(li.ts, 'epoch'::timestamptz)
    ) AS last_active_at,
    COALESCE((
      SELECT COUNT(DISTINCT date_trunc('day', a.ts))::integer
      FROM activity a
      WHERE a.user_id = m.user_id
    ), 0) AS active_days_30d
  FROM members m
  LEFT JOIN last_login ll ON ll.user_id = m.user_id
  LEFT JOIN last_interaction li ON li.user_id = m.user_id;
END;
$$;
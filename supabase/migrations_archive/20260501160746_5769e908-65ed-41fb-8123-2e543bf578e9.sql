-- RPC: engagement distribution aggregated server-side (bypasses 1000-row PostgREST cap)
CREATE OR REPLACE FUNCTION public.get_org_engagement_distribution(
  p_org_id uuid,
  p_campus_id uuid DEFAULT NULL
)
RETURNS TABLE(engagement_level text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ces.engagement_level::text, COUNT(*)::bigint
  FROM public.contact_engagement_scores ces
  WHERE ces.organization_id = p_org_id
    AND (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
      )
      OR public.is_system_admin(auth.uid())
    )
    AND (
      p_campus_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = ces.contact_id AND c.campus_id = p_campus_id
      )
    )
  GROUP BY ces.engagement_level;
$$;

-- RPC: check-in counts (week + month) aggregated server-side
CREATE OR REPLACE FUNCTION public.get_org_checkin_counts(
  p_org_id uuid,
  p_week_start timestamptz,
  p_month_start timestamptz,
  p_campus_id uuid DEFAULT NULL
)
RETURNS TABLE(checkins_week bigint, checkins_month bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE pc.checked_in_at >= p_week_start)::bigint AS checkins_week,
    COUNT(*) FILTER (WHERE pc.checked_in_at >= p_month_start)::bigint AS checkins_month
  FROM public.pco_checkins pc
  WHERE pc.organization_id = p_org_id
    AND pc.checked_in_at >= p_month_start
    AND (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
      )
      OR public.is_system_admin(auth.uid())
    )
    AND (
      p_campus_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = pc.contact_id AND c.campus_id = p_campus_id
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_org_engagement_distribution(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_checkin_counts(uuid, timestamptz, timestamptz, uuid) TO authenticated;
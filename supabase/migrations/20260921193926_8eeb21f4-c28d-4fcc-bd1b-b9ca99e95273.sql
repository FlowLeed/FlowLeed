CREATE OR REPLACE FUNCTION public.preview_engagement_settings(p_org_id uuid, p_settings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  WITH rows AS (
    SELECT * FROM public.compute_engagement_rows(p_org_id, p_settings)
  ),
  dist AS (
    SELECT engagement_level AS level, COUNT(*)::integer AS count FROM rows GROUP BY engagement_level
  ),
  samples AS (
    SELECT r.contact_id, c.name AS full_name, r.score, r.engagement_level,
           r.consecutive_weeks, r.weeks_window, r.breakdown
    FROM rows r JOIN contacts c ON c.id = r.contact_id
    ORDER BY r.score DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'distribution', COALESCE((SELECT jsonb_object_agg(level, count) FROM dist), '{}'::jsonb),
    'average_score', COALESCE((SELECT ROUND(AVG(score),1) FROM rows), 0),
    'people_scored', (SELECT COUNT(*) FROM rows),
    'samples', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM samples s), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
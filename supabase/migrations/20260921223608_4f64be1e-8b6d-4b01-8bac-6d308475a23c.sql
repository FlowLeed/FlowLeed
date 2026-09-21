DO $mig$
DECLARE d text; nd text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'compute_engagement_rows' AND n.nspname = 'public'
  LIMIT 1;

  nd := replace(d,
    'compute_engagement_rows(p_org_id uuid, p_settings jsonb)',
    'compute_engagement_rows(p_org_id uuid, p_settings jsonb, p_sample_limit integer DEFAULT NULL)');
  nd := replace(nd,
    'FROM ids i',
    'FROM (SELECT id_contact FROM ids ORDER BY id_contact LIMIT COALESCE(p_sample_limit, 2000000000)) i');

  EXECUTE 'DROP FUNCTION IF EXISTS public.compute_engagement_rows(uuid, jsonb)';
  EXECUTE nd;
END $mig$;

CREATE OR REPLACE FUNCTION public.preview_engagement_settings(p_org_id uuid, p_settings jsonb, p_sample_limit integer DEFAULT 2500)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_total integer;
  v_scanned integer;
  v_scale numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  SELECT COUNT(*)::integer INTO v_total FROM contacts c WHERE c.organization_id = p_org_id;

  WITH computed AS (
    SELECT * FROM public.compute_engagement_rows(p_org_id, p_settings, p_sample_limit)
  ),
  rows AS (
    SELECT
      r.contact_id,
      COALESCE(ls.frozen_score, r.score) AS score,
      COALESCE(ls.frozen_level, r.engagement_level) AS engagement_level,
      r.consecutive_weeks,
      r.weeks_window,
      COALESCE(ls.frozen_breakdown, r.breakdown) AS breakdown,
      (ls.id IS NOT NULL) AS paused
    FROM computed r
    LEFT JOIN contact_life_seasons ls
      ON ls.contact_id = r.contact_id AND ls.ended_on IS NULL
  ),
  dist AS (
    SELECT engagement_level AS level, COUNT(*)::integer AS count FROM rows GROUP BY engagement_level
  ),
  samples AS (
    SELECT r.contact_id, c.name AS full_name, r.score, r.engagement_level,
           r.consecutive_weeks, r.weeks_window, r.breakdown, r.paused
    FROM rows r JOIN contacts c ON c.id = r.contact_id
    ORDER BY r.score DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'distribution', COALESCE((SELECT jsonb_object_agg(level, count) FROM dist), '{}'::jsonb),
    'average_score', COALESCE((SELECT ROUND(AVG(score),1) FROM rows), 0),
    'people_scored', (SELECT COUNT(*) FROM rows),
    'paused_count', (SELECT COUNT(*) FROM rows WHERE paused),
    'samples', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM samples s), '[]'::jsonb)
  ) INTO v_result;

  v_scanned := COALESCE((v_result->>'people_scored')::integer, 0);
  v_result := v_result
    || jsonb_build_object(
      'total_contacts', v_total,
      'sample_limit', p_sample_limit,
      'sampled', (p_sample_limit IS NOT NULL AND v_scanned >= p_sample_limit)
    );

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.preview_engagement_settings(uuid, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_engagement_rows(uuid, jsonb, integer) TO authenticated, service_role;
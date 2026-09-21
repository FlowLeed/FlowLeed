CREATE TABLE public.contact_life_seasons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'other',
  note text,
  started_on date NOT NULL DEFAULT CURRENT_DATE,
  ended_on date,
  end_reason text,
  frozen_score integer,
  frozen_level text,
  frozen_breakdown jsonb,
  created_by_user_id uuid,
  ended_by_user_id uuid,
  last_reminded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_life_seasons TO authenticated;
GRANT ALL ON public.contact_life_seasons TO service_role;

ALTER TABLE public.contact_life_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view life seasons"
  ON public.contact_life_seasons FOR SELECT TO authenticated
  USING (public.is_user_in_organization(auth.uid(), organization_id));

CREATE POLICY "Org members can create life seasons"
  ON public.contact_life_seasons FOR INSERT TO authenticated
  WITH CHECK (public.is_user_in_organization(auth.uid(), organization_id));

CREATE POLICY "Org members can update life seasons"
  ON public.contact_life_seasons FOR UPDATE TO authenticated
  USING (public.is_user_in_organization(auth.uid(), organization_id))
  WITH CHECK (public.is_user_in_organization(auth.uid(), organization_id));

CREATE POLICY "Org members can delete life seasons"
  ON public.contact_life_seasons FOR DELETE TO authenticated
  USING (public.is_user_in_organization(auth.uid(), organization_id));

CREATE UNIQUE INDEX contact_life_seasons_one_active
  ON public.contact_life_seasons (contact_id) WHERE ended_on IS NULL;

CREATE INDEX contact_life_seasons_org_active
  ON public.contact_life_seasons (organization_id) WHERE ended_on IS NULL;

CREATE TRIGGER contact_life_seasons_updated_at
  BEFORE UPDATE ON public.contact_life_seasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Skip paused people when recalculating scores: their stored score stays frozen.
CREATE OR REPLACE FUNCTION public.calculate_engagement_scores(p_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings jsonb := public.engagement_settings_for_org(p_org_id);
BEGIN
  INSERT INTO contact_engagement_scores (
    contact_id, organization_id, total_checkins_90d, total_checkins_30d,
    weeks_attended_last_12, last_checkin_at, engagement_level,
    streak_weeks, consecutive_streak_weeks, volunteer_checkins_90d, score, score_breakdown, updated_at
  )
  SELECT
    c.contact_id, p_org_id, c.total_90d, c.total_30d, c.weeks_window, c.last_attended,
    c.engagement_level, c.weeks_window, c.consecutive_weeks, c.serving_count, c.score, c.breakdown, NOW()
  FROM public.compute_engagement_rows(p_org_id, v_settings) c
  WHERE NOT EXISTS (
    SELECT 1 FROM contact_life_seasons ls
    WHERE ls.contact_id = c.contact_id AND ls.ended_on IS NULL
  )
  ON CONFLICT (contact_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    total_checkins_90d = EXCLUDED.total_checkins_90d,
    total_checkins_30d = EXCLUDED.total_checkins_30d,
    weeks_attended_last_12 = EXCLUDED.weeks_attended_last_12,
    last_checkin_at = EXCLUDED.last_checkin_at,
    engagement_level = EXCLUDED.engagement_level,
    streak_weeks = EXCLUDED.streak_weeks,
    consecutive_streak_weeks = EXCLUDED.consecutive_streak_weeks,
    volunteer_checkins_90d = EXCLUDED.volunteer_checkins_90d,
    score = EXCLUDED.score,
    score_breakdown = EXCLUDED.score_breakdown,
    updated_at = NOW();

  PERFORM public.snapshot_engagement_distribution_all();
  PERFORM public.recompute_contact_markers(p_org_id);
END;
$function$;

-- Preview reflects frozen scores for paused people.
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

  WITH computed AS (
    SELECT * FROM public.compute_engagement_rows(p_org_id, p_settings)
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

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_engagement_scores(p_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_score integer;
  v_level text;
  v_freq_score numeric;
  v_recency_score numeric;
  v_streak_score numeric;
  v_volunteer_score numeric;
  v_days_since numeric;
BEGIN
  FOR r IN
    WITH household_person_ids AS (
      SELECT
        c1.id AS contact_id,
        c2.pc_person_id AS hh_person_id
      FROM contacts c1
      JOIN contacts c2 ON c2.pc_household_id = c1.pc_household_id
        AND c2.id != c1.id
        AND c2.pc_person_id IS NOT NULL
      WHERE c1.organization_id = p_org_id
        AND c1.pc_household_id IS NOT NULL
    ),
    family_person_ids AS (
      SELECT
        cfm.contact_id,
        cfm.pc_person_id AS fm_person_id
      FROM contact_family_members cfm
      JOIN contacts c ON c.id = cfm.contact_id
      WHERE c.organization_id = p_org_id
        AND cfm.pc_person_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM household_person_ids hp
          WHERE hp.contact_id = cfm.contact_id
            AND hp.hh_person_id = cfm.pc_person_id
        )
    ),
    all_checkins AS (
      SELECT c.id AS contact_id, pc.id AS checkin_id, pc.checked_in_at, pc.checkin_kind
      FROM contacts c
      JOIN pco_checkins pc ON pc.contact_id = c.id
      WHERE c.organization_id = p_org_id

      UNION ALL

      SELECT hp.contact_id, pc.id AS checkin_id, pc.checked_in_at, pc.checkin_kind
      FROM household_person_ids hp
      JOIN pco_checkins pc ON pc.pc_person_id = hp.hh_person_id

      UNION ALL

      SELECT fp.contact_id, pc.id AS checkin_id, pc.checked_in_at, pc.checkin_kind
      FROM family_person_ids fp
      JOIN pco_checkins pc ON pc.pc_person_id = fp.fm_person_id
    ),
    deduped AS (
      SELECT DISTINCT ON (contact_id, checkin_id)
        contact_id, checkin_id, checked_in_at, checkin_kind
      FROM all_checkins
    )
    SELECT
      d.contact_id,
      COALESCE(SUM(CASE WHEN d.checked_in_at >= NOW() - INTERVAL '90 days' THEN 1 ELSE 0 END), 0) AS total_90d,
      COALESCE(SUM(CASE WHEN d.checked_in_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END), 0) AS total_30d,
      COUNT(d.checkin_id) AS total_ever,
      MAX(d.checked_in_at) AS last_checkin,
      COUNT(DISTINCT EXTRACT(WEEK FROM d.checked_in_at) * 100 + EXTRACT(YEAR FROM d.checked_in_at))
        FILTER (WHERE d.checked_in_at >= NOW() - INTERVAL '84 days') AS weeks_12,
      COALESCE(SUM(CASE WHEN d.checkin_kind = 'volunteer' AND d.checked_in_at >= NOW() - INTERVAL '90 days' THEN 1 ELSE 0 END), 0) AS vol_90d
    FROM deduped d
    GROUP BY d.contact_id
  LOOP
    v_freq_score := LEAST((r.weeks_12::numeric / 12.0) * 40, 40);

    IF r.last_checkin IS NOT NULL THEN
      v_days_since := EXTRACT(EPOCH FROM (NOW() - r.last_checkin)) / 86400.0;
      v_recency_score := GREATEST(25 - (v_days_since / 90.0 * 25), 0);
    ELSE
      v_recency_score := 0;
    END IF;

    v_streak_score := LEAST(r.weeks_12 * 2, 20);
    v_volunteer_score := LEAST(r.vol_90d * 3, 15);

    v_score := ROUND(v_freq_score + v_recency_score + v_streak_score + v_volunteer_score)::integer;
    v_score := LEAST(v_score, 100);

    IF r.total_ever < 3 THEN
      v_level := 'new';
    ELSIF v_score >= 75 THEN
      v_level := 'highly_engaged';
    ELSIF v_score >= 50 THEN
      v_level := 'active';
    ELSIF v_score >= 25 THEN
      v_level := 'at_risk';
    ELSE
      v_level := 'inactive';
    END IF;

    INSERT INTO contact_engagement_scores (
      contact_id, organization_id, total_checkins_90d, total_checkins_30d,
      weeks_attended_last_12, last_checkin_at, engagement_level,
      streak_weeks, volunteer_checkins_90d, score, updated_at
    ) VALUES (
      r.contact_id, p_org_id, r.total_90d, r.total_30d,
      r.weeks_12, r.last_checkin, v_level,
      r.weeks_12, r.vol_90d, v_score, NOW()
    )
    ON CONFLICT (contact_id) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      total_checkins_90d = EXCLUDED.total_checkins_90d,
      total_checkins_30d = EXCLUDED.total_checkins_30d,
      weeks_attended_last_12 = EXCLUDED.weeks_attended_last_12,
      last_checkin_at = EXCLUDED.last_checkin_at,
      engagement_level = EXCLUDED.engagement_level,
      streak_weeks = EXCLUDED.streak_weeks,
      volunteer_checkins_90d = EXCLUDED.volunteer_checkins_90d,
      score = EXCLUDED.score,
      updated_at = NOW();
  END LOOP;
END;
$function$;

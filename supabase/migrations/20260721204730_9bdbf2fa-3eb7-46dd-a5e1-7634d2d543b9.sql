
CREATE OR REPLACE FUNCTION public.calculate_engagement_scores(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_score integer;
  v_level text;
  v_freq_score numeric;
  v_recency_score numeric;
  v_streak_score numeric;
  v_volunteer_score numeric;
  v_leader_score numeric;
  v_days_since numeric;
  v_last_activity timestamptz;
BEGIN
  FOR r IN
    WITH household_person_ids AS (
      SELECT c1.id AS contact_id, c2.pc_person_id AS hh_person_id
      FROM contacts c1
      JOIN contacts c2 ON c2.pc_household_id = c1.pc_household_id
        AND c2.id != c1.id
        AND c2.pc_person_id IS NOT NULL
      WHERE c1.organization_id = p_org_id
        AND c1.pc_household_id IS NOT NULL
    ),
    family_person_ids AS (
      SELECT cfm.contact_id, cfm.pc_person_id AS fm_person_id
      FROM contact_family_members cfm
      JOIN contacts c ON c.id = cfm.contact_id
      WHERE c.organization_id = p_org_id
        AND cfm.pc_person_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM household_person_ids hp
          WHERE hp.contact_id = cfm.contact_id AND hp.hh_person_id = cfm.pc_person_id
        )
    ),
    all_checkins AS (
      SELECT c.id AS contact_id, pc.id AS checkin_id, pc.checked_in_at, pc.checkin_kind
      FROM contacts c JOIN pco_checkins pc ON pc.contact_id = c.id
      WHERE c.organization_id = p_org_id
      UNION ALL
      SELECT hp.contact_id, pc.id, pc.checked_in_at, pc.checkin_kind
      FROM household_person_ids hp JOIN pco_checkins pc ON pc.pc_person_id = hp.hh_person_id
      UNION ALL
      SELECT fp.contact_id, pc.id, pc.checked_in_at, pc.checkin_kind
      FROM family_person_ids fp JOIN pco_checkins pc ON pc.pc_person_id = fp.fm_person_id
    ),
    deduped_checkins AS (
      SELECT DISTINCT ON (contact_id, checkin_id) contact_id, checkin_id, checked_in_at, checkin_kind
      FROM all_checkins
    ),
    group_att AS (
      SELECT ga.contact_id, ga.checked_in_at
      FROM group_attendance ga JOIN contacts c ON c.id = ga.contact_id
      WHERE c.organization_id = p_org_id AND ga.status = 'present' AND ga.checked_in_at IS NOT NULL
    ),
    combined_attendance AS (
      SELECT contact_id, checked_in_at FROM deduped_checkins
      UNION ALL
      SELECT contact_id, checked_in_at FROM group_att
    ),
    serving_signals AS (
      SELECT contact_id, checked_in_at AS occurred_at
      FROM deduped_checkins
      WHERE checkin_kind = 'volunteer' AND checked_in_at >= NOW() - INTERVAL '90 days'
      UNION ALL
      SELECT fm.contact_id, fm.occurred_at
      FROM flow_moments fm
      JOIN flow_moment_types fmt ON fmt.id = fm.flow_moment_type_id
      JOIN contacts c ON c.id = fm.contact_id
      WHERE c.organization_id = p_org_id
        AND fm.occurred_at >= NOW() - INTERVAL '90 days'
        AND (fmt.category = 'serving'
          OR fmt.name ILIKE '%serv%' OR fmt.name ILIKE '%volunteer%'
          OR fmt.name ILIKE '%dream team%' OR fmt.name ILIKE '%prayer team%'
          OR fmt.name ILIKE '%worship team%' OR fmt.name ILIKE '%group leader%')
    ),
    serving_agg AS (
      SELECT contact_id, COUNT(*) AS serving_90d, MAX(occurred_at) AS last_serving
      FROM serving_signals GROUP BY contact_id
    ),
    leadership AS (
      SELECT DISTINCT c.id AS contact_id
      FROM contacts c
      JOIN profiles p ON p.email IS NOT NULL AND lower(p.email) = lower(c.email)
      JOIN groups g ON g.organization_id = c.organization_id AND g.status = 'active'
        AND (g.leader_user_id = p.user_id OR g.co_leader_user_id = p.user_id)
      WHERE c.organization_id = p_org_id
      UNION
      SELECT DISTINCT gm.contact_id
      FROM group_members gm JOIN groups g ON g.id = gm.group_id
      WHERE g.organization_id = p_org_id AND g.status = 'active'
        AND gm.status = 'active' AND gm.role IN ('leader','co_leader','host')
    ),
    base AS (
      SELECT
        ca.contact_id,
        COALESCE(SUM(CASE WHEN ca.checked_in_at >= NOW() - INTERVAL '90 days' THEN 1 ELSE 0 END), 0) AS total_90d,
        COALESCE(SUM(CASE WHEN ca.checked_in_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END), 0) AS total_30d,
        COUNT(*) AS total_ever,
        MAX(ca.checked_in_at) AS last_attended,
        COUNT(DISTINCT EXTRACT(WEEK FROM ca.checked_in_at) * 100 + EXTRACT(YEAR FROM ca.checked_in_at))
          FILTER (WHERE ca.checked_in_at >= NOW() - INTERVAL '84 days') AS weeks_12
      FROM combined_attendance ca
      GROUP BY ca.contact_id
    ),
    vol_only AS (
      SELECT contact_id,
        COALESCE(SUM(CASE WHEN checkin_kind='volunteer' AND checked_in_at >= NOW() - INTERVAL '90 days' THEN 1 ELSE 0 END),0) AS vol_90d
      FROM deduped_checkins GROUP BY contact_id
    )
    SELECT
      b.contact_id, b.total_90d, b.total_30d, b.total_ever, b.last_attended, b.weeks_12,
      COALESCE(v.vol_90d, 0) AS vol_90d, COALESCE(s.serving_90d, 0) AS serving_90d,
      s.last_serving, CASE WHEN l.contact_id IS NOT NULL THEN true ELSE false END AS is_leader
    FROM base b
    LEFT JOIN vol_only v ON v.contact_id = b.contact_id
    LEFT JOIN serving_agg s ON s.contact_id = b.contact_id
    LEFT JOIN leadership l ON l.contact_id = b.contact_id
    UNION ALL
    SELECT x.contact_id, 0, 0, 0, NULL::timestamptz, 0, 0,
      COALESCE(s.serving_90d, 0), s.last_serving,
      CASE WHEN l.contact_id IS NOT NULL THEN true ELSE false END
    FROM (SELECT contact_id FROM serving_agg UNION SELECT contact_id FROM leadership) x
    LEFT JOIN serving_agg s ON s.contact_id = x.contact_id
    LEFT JOIN leadership l ON l.contact_id = x.contact_id
    WHERE NOT EXISTS (SELECT 1 FROM base b WHERE b.contact_id = x.contact_id)
  LOOP
    v_freq_score := LEAST((r.weeks_12::numeric / 12.0) * 35, 35);
    v_last_activity := GREATEST(COALESCE(r.last_attended, 'epoch'::timestamptz), COALESCE(r.last_serving, 'epoch'::timestamptz));
    IF v_last_activity > 'epoch'::timestamptz THEN
      v_days_since := EXTRACT(EPOCH FROM (NOW() - v_last_activity)) / 86400.0;
      v_recency_score := GREATEST(20 - (v_days_since / 90.0 * 20), 0);
    ELSE v_recency_score := 0; END IF;
    v_streak_score := LEAST(r.weeks_12 * 1.5, 15);
    v_volunteer_score := LEAST((r.vol_90d + r.serving_90d) * 4, 20);
    v_leader_score := CASE WHEN r.is_leader THEN 10 ELSE 0 END;
    v_score := ROUND(v_freq_score + v_recency_score + v_streak_score + v_volunteer_score + v_leader_score)::integer;
    v_score := LEAST(v_score, 100);

    IF r.total_ever < 3 AND NOT r.is_leader AND r.serving_90d = 0 THEN v_level := 'new';
    ELSIF v_score >= 75 THEN v_level := 'highly_engaged';
    ELSIF v_score >= 50 THEN v_level := 'active';
    ELSIF v_score >= 25 THEN v_level := 'at_risk';
    ELSE v_level := 'inactive'; END IF;

    IF (r.is_leader OR r.serving_90d > 0) AND v_level IN ('at_risk','inactive','new') THEN v_level := 'active'; END IF;

    -- Safeguard: someone who attended in the last 14 days is not "At Risk" or "Inactive"
    IF r.last_attended IS NOT NULL
       AND r.last_attended >= NOW() - INTERVAL '14 days'
       AND v_level IN ('at_risk','inactive') THEN
      v_level := 'active';
    END IF;

    INSERT INTO contact_engagement_scores (
      contact_id, organization_id, total_checkins_90d, total_checkins_30d,
      weeks_attended_last_12, last_checkin_at, engagement_level,
      streak_weeks, volunteer_checkins_90d, score, updated_at
    ) VALUES (
      r.contact_id, p_org_id, r.total_90d, r.total_30d,
      r.weeks_12, r.last_attended, v_level, r.weeks_12, (r.vol_90d + r.serving_90d), v_score, NOW()
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

  PERFORM public.snapshot_engagement_distribution_all();
  PERFORM public.recompute_contact_markers(p_org_id);
END;
$$;

-- Recompute for New Vintage Church so Eddie and others update right away
SELECT public.calculate_engagement_scores('5a730e55-ae24-496d-b3b9-6cfdda00ee04');

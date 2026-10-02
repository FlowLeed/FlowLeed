CREATE OR REPLACE FUNCTION public.engagement_settings_for_org(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'weights', COALESCE(s.weights, '{"consistency":35,"recency":20,"streak":15,"serving":20,"leadership":10}'::jsonb),
    'windows', COALESCE(s.windows, '{"consistency_weeks":12,"recency_days":90,"serving_days":90,"activity_days":90}'::jsonb),
    'thresholds', COALESCE(s.thresholds, '{"highly_engaged":75,"active":50,"at_risk":25,"new_max_checkins":3}'::jsonb),
    'ingredients', COALESCE(s.ingredients, '{"service_checkins":true,"group_attendance":true,"serving":true,"leadership":true}'::jsonb),
    'safeguards', COALESCE(s.safeguards, '{"serving_keeps_active":true,"recent_attendance_days":14,"household_credit":true,"streak_break_misses":1,"count_partial_week":false}'::jsonb)
  )
  FROM (SELECT p_org_id AS org) q
  LEFT JOIN public.org_engagement_settings s ON s.organization_id = q.org;
$function$;

CREATE OR REPLACE FUNCTION public.compute_engagement_rows(p_org_id uuid, p_settings jsonb)
RETURNS TABLE(
  contact_id uuid,
  total_90d integer,
  total_30d integer,
  total_ever integer,
  last_attended timestamptz,
  weeks_window integer,
  consecutive_weeks integer,
  serving_count integer,
  vol_90d integer,
  is_leader boolean,
  in_group boolean,
  moments_count integer,
  notes_count integer,
  forms_count integer,
  events_count integer,
  score integer,
  engagement_level text,
  breakdown jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  w_consistency numeric := COALESCE((p_settings->'weights'->>'consistency')::numeric, 0);
  w_recency numeric := COALESCE((p_settings->'weights'->>'recency')::numeric, 0);
  w_streak numeric := COALESCE((p_settings->'weights'->>'streak')::numeric, 0);
  w_serving numeric := COALESCE((p_settings->'weights'->>'serving')::numeric, 0);
  w_leader numeric := COALESCE((p_settings->'weights'->>'leadership')::numeric, 0);
  w_group numeric := COALESCE((p_settings->'weights'->>'group_membership')::numeric, 0);
  w_moments numeric := COALESCE((p_settings->'weights'->>'flow_moments')::numeric, 0);
  w_notes numeric := COALESCE((p_settings->'weights'->>'notes_interactions')::numeric, 0);
  w_forms numeric := COALESCE((p_settings->'weights'->>'form_submissions')::numeric, 0);
  w_events numeric := COALESCE((p_settings->'weights'->>'event_attendance')::numeric, 0);
  win_weeks integer := GREATEST(COALESCE((p_settings->'windows'->>'consistency_weeks')::integer, 12), 1);
  win_recency integer := GREATEST(COALESCE((p_settings->'windows'->>'recency_days')::integer, 90), 1);
  win_serving integer := GREATEST(COALESCE((p_settings->'windows'->>'serving_days')::integer, 90), 1);
  win_activity integer := GREATEST(COALESCE((p_settings->'windows'->>'activity_days')::integer, 90), 1);
  t_high numeric := COALESCE((p_settings->'thresholds'->>'highly_engaged')::numeric, 75);
  t_active numeric := COALESCE((p_settings->'thresholds'->>'active')::numeric, 50);
  t_risk numeric := COALESCE((p_settings->'thresholds'->>'at_risk')::numeric, 25);
  t_new integer := COALESCE((p_settings->'thresholds'->>'new_max_checkins')::integer, 3);
  i_service boolean := COALESCE((p_settings->'ingredients'->>'service_checkins')::boolean, true);
  i_groupatt boolean := COALESCE((p_settings->'ingredients'->>'group_attendance')::boolean, true);
  i_serving boolean := COALESCE((p_settings->'ingredients'->>'serving')::boolean, true);
  i_leader boolean := COALESCE((p_settings->'ingredients'->>'leadership')::boolean, true);
  i_group boolean := COALESCE((p_settings->'ingredients'->>'group_membership')::boolean, false);
  i_moments boolean := COALESCE((p_settings->'ingredients'->>'flow_moments')::boolean, false);
  i_notes boolean := COALESCE((p_settings->'ingredients'->>'notes_interactions')::boolean, false);
  i_forms boolean := COALESCE((p_settings->'ingredients'->>'form_submissions')::boolean, false);
  i_events boolean := COALESCE((p_settings->'ingredients'->>'event_attendance')::boolean, false);
  sg_serving_active boolean := COALESCE((p_settings->'safeguards'->>'serving_keeps_active')::boolean, true);
  sg_recent_days integer := COALESCE((p_settings->'safeguards'->>'recent_attendance_days')::integer, 14);
  sg_household boolean := COALESCE((p_settings->'safeguards'->>'household_credit')::boolean, true);
  sg_break integer := GREATEST(COALESCE((p_settings->'safeguards'->>'streak_break_misses')::integer, 1), 1);
  sg_partial boolean := COALESCE((p_settings->'safeguards'->>'count_partial_week')::boolean, false);
  v_total_weight numeric;
  v_earned numeric;
  v_consistency numeric;
  v_recency numeric;
  v_streak numeric;
  v_serving numeric;
  v_leaderp numeric;
  v_groupp numeric;
  v_momentsp numeric;
  v_notesp numeric;
  v_formsp numeric;
  v_eventsp numeric;
  v_days_since numeric;
  v_last_activity timestamptz;
  v_score integer;
  v_level text;
  v_streak_weeks integer;
  v_misses integer;
  v_offset integer;
  v_cursor date;
  v_start date;
BEGIN
  v_total_weight :=
    (CASE WHEN i_service OR i_groupatt THEN w_consistency + w_recency + w_streak ELSE 0 END)
    + (CASE WHEN i_serving THEN w_serving ELSE 0 END)
    + (CASE WHEN i_leader THEN w_leader ELSE 0 END)
    + (CASE WHEN i_group THEN w_group ELSE 0 END)
    + (CASE WHEN i_moments THEN w_moments ELSE 0 END)
    + (CASE WHEN i_notes THEN w_notes ELSE 0 END)
    + (CASE WHEN i_forms THEN w_forms ELSE 0 END)
    + (CASE WHEN i_events THEN w_events ELSE 0 END);
  IF v_total_weight <= 0 THEN v_total_weight := 100; END IF;

  v_start := (date_trunc('week', NOW())::date) - CASE WHEN sg_partial THEN 0 ELSE 7 END;

  FOR r IN
    WITH household_person_ids AS (
      SELECT c1.id AS contact_id, c2.pc_person_id AS hh_person_id
      FROM contacts c1
      JOIN contacts c2 ON c2.pc_household_id = c1.pc_household_id
        AND c2.id != c1.id AND c2.pc_person_id IS NOT NULL
      WHERE c1.organization_id = p_org_id AND c1.pc_household_id IS NOT NULL AND sg_household
    ),
    family_person_ids AS (
      SELECT cfm.contact_id, cfm.pc_person_id AS fm_person_id
      FROM contact_family_members cfm
      JOIN contacts c ON c.id = cfm.contact_id
      WHERE c.organization_id = p_org_id AND cfm.pc_person_id IS NOT NULL AND sg_household
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
        AND i_groupatt
    ),
    combined_attendance AS (
      SELECT contact_id, checked_in_at FROM deduped_checkins WHERE i_service
      UNION ALL
      SELECT contact_id, checked_in_at FROM group_att
    ),
    serving_signals AS (
      SELECT contact_id, checked_in_at AS occurred_at
      FROM deduped_checkins
      WHERE i_serving AND checkin_kind = 'volunteer'
        AND checked_in_at >= NOW() - (win_serving || ' days')::interval
      UNION ALL
      SELECT fm.contact_id, fm.occurred_at
      FROM flow_moments fm
      JOIN flow_moment_types fmt ON fmt.id = fm.flow_moment_type_id
      JOIN contacts c ON c.id = fm.contact_id
      WHERE c.organization_id = p_org_id AND i_serving
        AND fm.occurred_at >= NOW() - (win_serving || ' days')::interval
        AND (fmt.category = 'serving'
          OR fmt.name ILIKE '%serv%' OR fmt.name ILIKE '%volunteer%'
          OR fmt.name ILIKE '%dream team%' OR fmt.name ILIKE '%prayer team%'
          OR fmt.name ILIKE '%worship team%' OR fmt.name ILIKE '%group leader%')
    ),
    serving_agg AS (
      SELECT contact_id, COUNT(*)::integer AS serving_90d, MAX(occurred_at) AS last_serving
      FROM serving_signals GROUP BY contact_id
    ),
    leadership AS (
      SELECT DISTINCT c.id AS contact_id
      FROM contacts c
      JOIN profiles p ON p.email IS NOT NULL AND lower(p.email) = lower(c.email)
      JOIN groups g ON g.organization_id = c.organization_id AND g.status = 'active'
        AND (g.leader_user_id = p.user_id OR g.co_leader_user_id = p.user_id)
      WHERE c.organization_id = p_org_id AND i_leader
      UNION
      SELECT DISTINCT gm.contact_id
      FROM group_members gm JOIN groups g ON g.id = gm.group_id
      WHERE g.organization_id = p_org_id AND i_leader
        AND g.status = 'active' AND gm.status = 'active' AND gm.role IN ('leader','co_leader','host')
    ),
    group_member AS (
      SELECT DISTINCT gm.contact_id
      FROM group_members gm JOIN groups g ON g.id = gm.group_id
      WHERE g.organization_id = p_org_id AND i_group
        AND g.status = 'active' AND gm.status = 'active'
    ),
    moments_agg AS (
      SELECT fm.contact_id, COUNT(*)::integer AS cnt
      FROM flow_moments fm JOIN contacts c ON c.id = fm.contact_id
      WHERE c.organization_id = p_org_id AND i_moments
        AND fm.occurred_at >= NOW() - (win_activity || ' days')::interval
      GROUP BY fm.contact_id
    ),
    notes_agg AS (
      SELECT x.contact_id, SUM(x.cnt)::integer AS cnt FROM (
        SELECT cn.contact_id, COUNT(*)::integer AS cnt
        FROM contact_notes cn JOIN contacts c ON c.id = cn.contact_id
        WHERE c.organization_id = p_org_id AND i_notes
          AND cn.created_at >= NOW() - (win_activity || ' days')::interval
        GROUP BY cn.contact_id
        UNION ALL
        SELECT ci.contact_id, COUNT(*)::integer
        FROM contact_interactions ci JOIN contacts c ON c.id = ci.contact_id
        WHERE c.organization_id = p_org_id AND i_notes
          AND ci.created_at >= NOW() - (win_activity || ' days')::interval
        GROUP BY ci.contact_id
      ) x GROUP BY x.contact_id
    ),
    forms_agg AS (
      SELECT fs.contact_id, COUNT(*)::integer AS cnt
      FROM form_submissions fs JOIN contacts c ON c.id = fs.contact_id
      WHERE c.organization_id = p_org_id AND i_forms
        AND fs.created_at >= NOW() - (win_activity || ' days')::interval
      GROUP BY fs.contact_id
    ),
    events_agg AS (
      SELECT coe.contact_id, COUNT(*)::integer AS cnt
      FROM church_online_events coe JOIN contacts c ON c.id = coe.contact_id
      WHERE c.organization_id = p_org_id AND i_events
        AND coe.created_at >= NOW() - (win_activity || ' days')::interval
      GROUP BY coe.contact_id
    ),
    base AS (
      SELECT
        ca.contact_id,
        COALESCE(SUM(CASE WHEN ca.checked_in_at >= NOW() - INTERVAL '90 days' THEN 1 ELSE 0 END), 0)::integer AS total_90d,
        COALESCE(SUM(CASE WHEN ca.checked_in_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END), 0)::integer AS total_30d,
        COUNT(*)::integer AS total_ever,
        MAX(ca.checked_in_at) AS last_attended,
        COUNT(DISTINCT date_trunc('week', ca.checked_in_at))
          FILTER (WHERE ca.checked_in_at >= NOW() - ((win_weeks * 7) || ' days')::interval)::integer AS weeks_window,
        ARRAY_AGG(DISTINCT date_trunc('week', ca.checked_in_at)::date) AS attended_weeks
      FROM combined_attendance ca
      GROUP BY ca.contact_id
    ),
    vol_only AS (
      SELECT contact_id,
        COALESCE(SUM(CASE WHEN checkin_kind='volunteer' AND checked_in_at >= NOW() - (win_serving || ' days')::interval THEN 1 ELSE 0 END),0)::integer AS vol_90d
      FROM deduped_checkins GROUP BY contact_id
    ),
    ids AS (
      SELECT contact_id FROM base
      UNION SELECT contact_id FROM serving_agg
      UNION SELECT contact_id FROM leadership
      UNION SELECT contact_id FROM group_member
      UNION SELECT contact_id FROM moments_agg
      UNION SELECT contact_id FROM notes_agg
      UNION SELECT contact_id FROM forms_agg
      UNION SELECT contact_id FROM events_agg
    )
    SELECT
      i.contact_id,
      COALESCE(b.total_90d,0) AS total_90d,
      COALESCE(b.total_30d,0) AS total_30d,
      COALESCE(b.total_ever,0) AS total_ever,
      b.last_attended,
      COALESCE(b.weeks_window,0) AS weeks_window,
      COALESCE(b.attended_weeks, ARRAY[]::date[]) AS attended_weeks,
      COALESCE(v.vol_90d, 0) AS vol_90d,
      COALESCE(s.serving_90d, 0) AS serving_90d,
      s.last_serving,
      (l.contact_id IS NOT NULL) AS is_leader,
      (g.contact_id IS NOT NULL) AS in_group,
      COALESCE(m.cnt, 0) AS moments_count,
      COALESCE(n.cnt, 0) AS notes_count,
      COALESCE(f.cnt, 0) AS forms_count,
      COALESCE(e.cnt, 0) AS events_count
    FROM ids i
    LEFT JOIN base b ON b.contact_id = i.contact_id
    LEFT JOIN vol_only v ON v.contact_id = i.contact_id
    LEFT JOIN serving_agg s ON s.contact_id = i.contact_id
    LEFT JOIN leadership l ON l.contact_id = i.contact_id
    LEFT JOIN group_member g ON g.contact_id = i.contact_id
    LEFT JOIN moments_agg m ON m.contact_id = i.contact_id
    LEFT JOIN notes_agg n ON n.contact_id = i.contact_id
    LEFT JOIN forms_agg f ON f.contact_id = i.contact_id
    LEFT JOIN events_agg e ON e.contact_id = i.contact_id
  LOOP
    -- consecutive week streak, allowing up to sg_break missed weeks before breaking
    v_streak_weeks := 0;
    v_misses := 0;
    v_offset := 0;
    WHILE v_offset < 104 LOOP
      v_cursor := v_start - (v_offset * 7);
      IF v_cursor = ANY (r.attended_weeks) THEN
        v_streak_weeks := v_streak_weeks + 1;
        v_misses := 0;
      ELSE
        v_misses := v_misses + 1;
        IF v_misses >= sg_break THEN EXIT; END IF;
      END IF;
      v_offset := v_offset + 1;
    END LOOP;

    v_consistency := CASE WHEN (i_service OR i_groupatt)
      THEN LEAST(r.weeks_window::numeric / win_weeks, 1) * w_consistency ELSE 0 END;

    v_last_activity := GREATEST(COALESCE(r.last_attended, 'epoch'::timestamptz), COALESCE(r.last_serving, 'epoch'::timestamptz));
    IF (i_service OR i_groupatt) AND v_last_activity > 'epoch'::timestamptz THEN
      v_days_since := EXTRACT(EPOCH FROM (NOW() - v_last_activity)) / 86400.0;
      v_recency := GREATEST(w_recency - (v_days_since / win_recency * w_recency), 0);
    ELSE
      v_recency := 0;
    END IF;

    v_streak := CASE WHEN (i_service OR i_groupatt)
      THEN LEAST(v_streak_weeks::numeric / 10.0, 1) * w_streak ELSE 0 END;
    v_serving := CASE WHEN i_serving
      THEN LEAST((r.vol_90d + r.serving_90d)::numeric / 5.0, 1) * w_serving ELSE 0 END;
    v_leaderp := CASE WHEN i_leader AND r.is_leader THEN w_leader ELSE 0 END;
    v_groupp := CASE WHEN i_group AND r.in_group THEN w_group ELSE 0 END;
    v_momentsp := CASE WHEN i_moments THEN LEAST(r.moments_count::numeric / 3.0, 1) * w_moments ELSE 0 END;
    v_notesp := CASE WHEN i_notes THEN LEAST(r.notes_count::numeric / 3.0, 1) * w_notes ELSE 0 END;
    v_formsp := CASE WHEN i_forms THEN LEAST(r.forms_count::numeric / 2.0, 1) * w_forms ELSE 0 END;
    v_eventsp := CASE WHEN i_events THEN LEAST(r.events_count::numeric / 3.0, 1) * w_events ELSE 0 END;

    v_earned := v_consistency + v_recency + v_streak + v_serving + v_leaderp
      + v_groupp + v_momentsp + v_notesp + v_formsp + v_eventsp;
    v_score := LEAST(ROUND(v_earned / v_total_weight * 100)::integer, 100);

    IF r.total_ever < t_new AND NOT r.is_leader AND r.serving_90d = 0 THEN v_level := 'new';
    ELSIF v_score >= t_high THEN v_level := 'highly_engaged';
    ELSIF v_score >= t_active THEN v_level := 'active';
    ELSIF v_score >= t_risk THEN v_level := 'at_risk';
    ELSE v_level := 'inactive'; END IF;

    IF sg_serving_active AND (r.is_leader OR r.serving_90d > 0) AND v_level IN ('at_risk','inactive','new') THEN
      v_level := 'active';
    END IF;

    IF sg_recent_days > 0 AND r.last_attended IS NOT NULL
       AND r.last_attended >= NOW() - (sg_recent_days || ' days')::interval
       AND v_level IN ('at_risk','inactive') THEN
      v_level := 'active';
    END IF;

    RETURN QUERY SELECT
      r.contact_id, r.total_90d, r.total_30d, r.total_ever, r.last_attended,
      r.weeks_window, v_streak_weeks, (r.vol_90d + r.serving_90d)::integer, r.vol_90d,
      r.is_leader, r.in_group, r.moments_count, r.notes_count, r.forms_count, r.events_count,
      v_score, v_level,
      jsonb_build_object(
        'total_weight', v_total_weight,
        'consistency', jsonb_build_object('earned', ROUND(v_consistency,1), 'max', w_consistency),
        'recency', jsonb_build_object('earned', ROUND(v_recency,1), 'max', w_recency),
        'streak', jsonb_build_object('earned', ROUND(v_streak,1), 'max', w_streak),
        'serving', jsonb_build_object('earned', ROUND(v_serving,1), 'max', w_serving),
        'leadership', jsonb_build_object('earned', ROUND(v_leaderp,1), 'max', w_leader),
        'group_membership', jsonb_build_object('earned', ROUND(v_groupp,1), 'max', w_group),
        'flow_moments', jsonb_build_object('earned', ROUND(v_momentsp,1), 'max', w_moments),
        'notes_interactions', jsonb_build_object('earned', ROUND(v_notesp,1), 'max', w_notes),
        'form_submissions', jsonb_build_object('earned', ROUND(v_formsp,1), 'max', w_forms),
        'event_attendance', jsonb_build_object('earned', ROUND(v_eventsp,1), 'max', w_events)
      );
  END LOOP;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.preview_engagement_settings(p_org_id uuid, p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
    SELECT r.contact_id, c.first_name, c.last_name, r.score, r.engagement_level,
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

REVOKE ALL ON FUNCTION public.compute_engagement_rows(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.engagement_settings_for_org(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.preview_engagement_settings(uuid, jsonb) FROM anon;
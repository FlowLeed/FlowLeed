CREATE OR REPLACE FUNCTION public.recompute_contact_markers(p_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.contact_markers WHERE organization_id = p_org_id;

  WITH
  household_person_ids AS (
    SELECT c1.id AS contact_id, c2.pc_person_id AS hh_person_id
    FROM contacts c1
    JOIN contacts c2 ON c2.pc_household_id = c1.pc_household_id
      AND c2.id <> c1.id
      AND c2.pc_person_id IS NOT NULL
    WHERE c1.organization_id = p_org_id
      AND c1.pc_household_id IS NOT NULL
  ),
  own_checkins AS (
    SELECT c.id AS contact_id, pc.checked_in_at, pc.checkin_kind, pc.event_name
    FROM contacts c
    JOIN pco_checkins pc ON pc.contact_id = c.id
    WHERE c.organization_id = p_org_id
  ),
  household_checkins AS (
    SELECT hp.contact_id, pc.checked_in_at
    FROM household_person_ids hp
    JOIN pco_checkins pc ON pc.pc_person_id = hp.hh_person_id
  ),
  attendance_stats AS (
    SELECT
      contact_id,
      MAX(checked_in_at) AS last_attended,
      COUNT(*) FILTER (WHERE checked_in_at >= NOW() - INTERVAL '14 days') AS in_14d,
      COUNT(*) FILTER (WHERE checked_in_at >= NOW() - INTERVAL '30 days') AS in_30d,
      COUNT(DISTINCT date_trunc('week', checked_in_at))
        FILTER (WHERE checked_in_at >= NOW() - INTERVAL '28 days') AS weeks_last_4,
      COUNT(DISTINCT date_trunc('week', checked_in_at))
        FILTER (WHERE checked_in_at >= NOW() - INTERVAL '84 days') AS weeks_last_12,
      COUNT(DISTINCT date_trunc('week', checked_in_at))
        FILTER (WHERE checked_in_at >= NOW() - INTERVAL '168 days'
                  AND checked_in_at <  NOW() - INTERVAL '84 days') AS weeks_prior_12,
      COUNT(*) AS total_ever,
      COUNT(*) FILTER (WHERE checkin_kind = 'guest' AND checked_in_at >= NOW() - INTERVAL '30 days') AS guest_30d,
      COUNT(*) FILTER (WHERE checkin_kind = 'volunteer' AND checked_in_at >= NOW() - INTERVAL '30 days') AS vol_30d,
      COUNT(*) FILTER (WHERE checkin_kind = 'volunteer' AND checked_in_at >= NOW() - INTERVAL '90 days') AS vol_90d,
      COUNT(*) FILTER (WHERE checkin_kind = 'volunteer' AND checked_in_at >= NOW() - INTERVAL '180 days') AS vol_180d,
      MAX(checked_in_at) FILTER (WHERE checkin_kind = 'volunteer') AS last_volunteered
    FROM own_checkins
    GROUP BY contact_id
  ),
  household_stats AS (
    SELECT contact_id, COUNT(*) AS hh_30d
    FROM household_checkins
    WHERE checked_in_at >= NOW() - INTERVAL '30 days'
    GROUP BY contact_id
  ),
  group_member_rows AS (
    SELECT gm.contact_id, gm.group_id, gm.id AS gm_id, gm.last_attended_at
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    JOIN contacts c ON c.id = gm.contact_id
    WHERE g.organization_id = p_org_id
      AND g.status = 'active'
      AND gm.status = 'active'
      AND c.organization_id = p_org_id
  ),
  recent_group_meetings AS (
    SELECT group_id, id AS meeting_id, meeting_date,
      row_number() OVER (PARTITION BY group_id ORDER BY meeting_date DESC) AS rn
    FROM group_meetings
    WHERE meeting_date IS NOT NULL
  ),
  group_attendance_rate AS (
    SELECT
      gmr.contact_id,
      COUNT(*) FILTER (WHERE rgm.meeting_id IS NOT NULL) AS meetings_count,
      COUNT(*) FILTER (WHERE ga.status = 'present') AS attended_count,
      MAX(ga.checked_in_at) FILTER (WHERE ga.status = 'present') AS last_group_attended
    FROM group_member_rows gmr
    LEFT JOIN recent_group_meetings rgm ON rgm.group_id = gmr.group_id AND rgm.rn <= 8
    LEFT JOIN group_attendance ga
      ON ga.group_member_id = gmr.gm_id
     AND ga.group_meeting_id = rgm.meeting_id
    GROUP BY gmr.contact_id
  ),
  flow_moment_stats AS (
    SELECT
      fm.contact_id,
      MAX(fm.occurred_at) AS last_moment,
      MAX(fm.occurred_at) FILTER (
        WHERE fm.occurred_at >= NOW() - INTERVAL '365 days'
          AND (fmt.category = 'salvation' OR fmt.name ILIKE '%salvation%' OR fmt.name ILIKE '%decision%')
      ) AS last_salvation,
      COUNT(*) FILTER (WHERE fm.occurred_at >= NOW() - INTERVAL '90 days') AS moments_90d
    FROM flow_moments fm
    JOIN contacts c ON c.id = fm.contact_id
    LEFT JOIN flow_moment_types fmt ON fmt.id = fm.flow_moment_type_id
    WHERE c.organization_id = p_org_id
    GROUP BY fm.contact_id
  ),
  pipeline_stats AS (
    SELECT
      pc.contact_id,
      COUNT(*) AS active_flows,
      MIN(EXTRACT(EPOCH FROM (NOW() - pc.stage_entered_at)) / 86400.0) AS min_days_in_stage,
      MAX(EXTRACT(EPOCH FROM (NOW() - pc.stage_entered_at)) / 86400.0) AS max_days_in_stage
    FROM pipeline_contacts pc
    JOIN pipelines p ON p.id = pc.pipeline_id
    JOIN contacts c ON c.id = pc.contact_id
    WHERE c.organization_id = p_org_id
      AND p.organization_id = p_org_id
      AND pc.completed_end_at IS NULL
    GROUP BY pc.contact_id
  ),
  online_stats AS (
    SELECT
      coe.contact_id,
      COUNT(*) FILTER (WHERE coe.created_at >= NOW() - INTERVAL '30 days') AS watch_30d,
      COUNT(*) FILTER (WHERE coe.event_type ILIKE '%prayer%' AND coe.created_at >= NOW() - INTERVAL '90 days') AS prayer_90d
    FROM church_online_events coe
    JOIN contacts c ON c.id = coe.contact_id
    WHERE c.organization_id = p_org_id
    GROUP BY coe.contact_id
  ),
  base_contacts AS (
    SELECT id AS contact_id FROM contacts WHERE organization_id = p_org_id
  ),
  combined AS (
    SELECT
      bc.contact_id,
      COALESCE(a.in_14d, 0)            AS in_14d,
      COALESCE(a.in_30d, 0)            AS in_30d,
      COALESCE(a.weeks_last_4, 0)      AS weeks_last_4,
      COALESCE(a.weeks_last_12, 0)     AS weeks_last_12,
      COALESCE(a.weeks_prior_12, 0)    AS weeks_prior_12,
      COALESCE(a.total_ever, 0)        AS total_ever,
      a.last_attended,
      COALESCE(a.guest_30d, 0)         AS guest_30d,
      COALESCE(a.vol_30d, 0)           AS vol_30d,
      COALESCE(a.vol_90d, 0)           AS vol_90d,
      COALESCE(a.vol_180d, 0)          AS vol_180d,
      a.last_volunteered,
      COALESCE(h.hh_30d, 0)            AS hh_30d,
      COALESCE(gar.meetings_count, 0)  AS group_meetings_count,
      COALESCE(gar.attended_count, 0)  AS group_attended_count,
      gar.last_group_attended,
      CASE WHEN EXISTS (SELECT 1 FROM group_member_rows g WHERE g.contact_id = bc.contact_id) THEN true ELSE false END AS in_group,
      fms.last_salvation,
      COALESCE(fms.moments_90d, 0)     AS moments_90d,
      COALESCE(ps.active_flows, 0)     AS active_flows,
      ps.max_days_in_stage,
      COALESCE(os.watch_30d, 0)        AS watch_30d,
      COALESCE(os.prayer_90d, 0)       AS prayer_90d
    FROM base_contacts bc
    LEFT JOIN attendance_stats a    ON a.contact_id   = bc.contact_id
    LEFT JOIN household_stats h     ON h.contact_id   = bc.contact_id
    LEFT JOIN group_attendance_rate gar ON gar.contact_id = bc.contact_id
    LEFT JOIN flow_moment_stats fms ON fms.contact_id = bc.contact_id
    LEFT JOIN pipeline_stats ps     ON ps.contact_id  = bc.contact_id
    LEFT JOIN online_stats os       ON os.contact_id  = bc.contact_id
  ),
  emitted AS (
    SELECT contact_id, key, value_text, value_numeric FROM (
      SELECT contact_id, 'attended_sunday_recent'::text AS key,
        'Last attended '||to_char(last_attended,'Mon DD') AS value_text,
        EXTRACT(EPOCH FROM (NOW() - last_attended))/86400.0 AS value_numeric
      FROM combined WHERE in_14d > 0
      UNION ALL
      SELECT contact_id, 'consistent_attender',
        weeks_last_4||' of last 4 weeks attended', weeks_last_4
      FROM combined WHERE weeks_last_4 >= 3
      UNION ALL
      SELECT contact_id, 'first_time_guest',
        'Guest check-in in last 30 days', guest_30d
      FROM combined WHERE guest_30d > 0
      UNION ALL
      SELECT contact_id, 'kids_checked_in',
        hh_30d||' household check-in(s) in last 30 days', hh_30d
      FROM combined WHERE hh_30d > 0
      UNION ALL
      SELECT contact_id, 'missed_3_sundays',
        'No attendance in 3+ weeks (previously regular)', NULL
      FROM combined
      WHERE total_ever >= 4
        AND (last_attended IS NULL OR last_attended < NOW() - INTERVAL '21 days')
        AND (last_attended IS NULL OR last_attended >= NOW() - INTERVAL '42 days')
      UNION ALL
      SELECT contact_id, 'drifting_6_weeks',
        'No attendance in 6+ weeks (previously regular)', NULL
      FROM combined
      WHERE total_ever >= 4
        AND (last_attended IS NULL OR last_attended < NOW() - INTERVAL '42 days')
      UNION ALL
      SELECT contact_id, 'attendance_dropped',
        'Attended '||weeks_last_12||' of last 12 weeks vs '||weeks_prior_12||' of prior 12',
        weeks_prior_12 - weeks_last_12
      FROM combined
      WHERE weeks_prior_12 >= 4
        AND weeks_last_12 <= weeks_prior_12 / 2
        AND weeks_last_12 < weeks_prior_12
      UNION ALL
      SELECT contact_id, 'in_group', 'Active small-group member', NULL
      FROM combined WHERE in_group
      UNION ALL
      SELECT contact_id, 'group_attendance_high',
        group_attended_count||' of last '||group_meetings_count||' meetings',
        ROUND((group_attended_count::numeric / NULLIF(group_meetings_count,0)) * 100)
      FROM combined
      WHERE group_meetings_count >= 3
        AND group_attended_count::numeric / group_meetings_count >= 0.66
      UNION ALL
      SELECT contact_id, 'group_attendance_mid',
        group_attended_count||' of last '||group_meetings_count||' meetings',
        ROUND((group_attended_count::numeric / NULLIF(group_meetings_count,0)) * 100)
      FROM combined
      WHERE group_meetings_count >= 3
        AND group_attended_count::numeric / group_meetings_count >= 0.33
        AND group_attended_count::numeric / group_meetings_count <  0.66
      UNION ALL
      SELECT contact_id, 'group_attendance_low',
        group_attended_count||' of last '||group_meetings_count||' meetings',
        ROUND((group_attended_count::numeric / NULLIF(group_meetings_count,0)) * 100)
      FROM combined
      WHERE group_meetings_count >= 4
        AND group_attended_count::numeric / group_meetings_count < 0.33
      UNION ALL
      SELECT contact_id, 'group_inactive_30d',
        'In a group but no attendance in 30+ days', NULL
      FROM combined
      WHERE in_group
        AND (last_group_attended IS NULL OR last_group_attended < NOW() - INTERVAL '30 days')
      UNION ALL
      SELECT contact_id, 'served_recently',
        'Served '||vol_30d||' time(s) in last 30 days', vol_30d
      FROM combined WHERE vol_30d > 0
      UNION ALL
      SELECT contact_id, 'serves_regularly',
        'Served '||vol_90d||' times in last 90 days', vol_90d
      FROM combined WHERE vol_90d >= 3
      UNION ALL
      SELECT contact_id, 'stopped_serving',
        'Used to serve, none in 60+ days', vol_180d
      FROM combined
      WHERE vol_180d >= 3
        AND vol_90d = 0
        AND (last_volunteered IS NULL OR last_volunteered < NOW() - INTERVAL '60 days')
      UNION ALL
      SELECT contact_id, 'in_active_flow',
        'In '||active_flows||' active flow(s)', active_flows
      FROM combined WHERE active_flows > 0
      UNION ALL
      SELECT contact_id, 'stuck_in_stage_30d',
        ROUND(max_days_in_stage)||' days in current stage', ROUND(max_days_in_stage)
      FROM combined WHERE max_days_in_stage IS NOT NULL AND max_days_in_stage >= 30
      UNION ALL
      SELECT contact_id, 'flow_moment_recent',
        moments_90d||' next step(s) in last 90 days', moments_90d
      FROM combined WHERE moments_90d > 0
      UNION ALL
      SELECT contact_id, 'salvation_moment',
        'Salvation decision recorded', NULL
      FROM combined WHERE last_salvation IS NOT NULL
      UNION ALL
      SELECT contact_id, 'watched_online_recent',
        watch_30d||' online event(s) in last 30 days', watch_30d
      FROM combined WHERE watch_30d > 0
      UNION ALL
      SELECT contact_id, 'prayer_request_submitted',
        prayer_90d||' prayer request(s) in last 90 days', prayer_90d
      FROM combined WHERE prayer_90d > 0
    ) sub
  )
  INSERT INTO public.contact_markers (contact_id, organization_id, marker_key, polarity, value_text, value_numeric, computed_at)
  SELECT
    e.contact_id,
    p_org_id,
    e.key,
    md.polarity,
    e.value_text,
    e.value_numeric,
    NOW()
  FROM emitted e
  JOIN marker_definitions md ON md.key = e.key;

  WITH marker_counts AS (
    SELECT
      cm.contact_id,
      COUNT(*) FILTER (WHERE cm.polarity = 'positive') AS pos,
      COUNT(*) FILTER (WHERE cm.polarity = 'negative') AS neg,
      bool_or(cm.marker_key = 'drifting_6_weeks')      AS is_drifting,
      bool_or(cm.marker_key IN ('missed_3_sundays','attendance_dropped','group_attendance_low','group_inactive_30d','stopped_serving')) AS is_slowing,
      bool_or(cm.marker_key = 'attended_sunday_recent') AS recent_attendance
    FROM contact_markers cm
    WHERE cm.organization_id = p_org_id
    GROUP BY cm.contact_id
  ),
  derived AS (
    SELECT
      ces.contact_id,
      CASE
        WHEN COALESCE(mc.is_drifting, false) THEN 'drifting'
        WHEN ces.total_checkins_90d = 0 AND ces.last_checkin_at IS NULL AND ces.weeks_attended_last_12 = 0
             AND NOT COALESCE(mc.pos > 0, false) THEN 'new'
        WHEN COALESCE(mc.is_slowing, false) AND COALESCE(mc.neg, 0) >= COALESCE(mc.pos, 0) THEN 'slowing'
        WHEN COALESCE(mc.pos, 0) >= 3 AND COALESCE(mc.neg, 0) = 0 AND COALESCE(mc.recent_attendance, false) THEN 'thriving'
        WHEN COALESCE(mc.pos, 0) >= 1 AND COALESCE(mc.neg, 0) <= 1 THEN 'steady'
        WHEN COALESCE(mc.neg, 0) >= 1 THEN 'slowing'
        ELSE 'new'
      END AS signal
    FROM contact_engagement_scores ces
    LEFT JOIN marker_counts mc ON mc.contact_id = ces.contact_id
    WHERE ces.organization_id = p_org_id
  )
  UPDATE contact_engagement_scores ces
  SET signal = d.signal
  FROM derived d
  WHERE ces.contact_id = d.contact_id;
END;
$function$;
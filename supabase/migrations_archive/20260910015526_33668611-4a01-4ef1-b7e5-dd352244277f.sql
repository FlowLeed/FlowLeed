-- 1. Per-org settings for built-in markers
CREATE TABLE IF NOT EXISTS public.org_marker_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  marker_key text NOT NULL REFERENCES public.marker_definitions(key) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  custom_label text,
  custom_description text,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, marker_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_marker_settings TO authenticated;
GRANT ALL ON public.org_marker_settings TO service_role;

ALTER TABLE public.org_marker_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view marker settings"
  ON public.org_marker_settings FOR SELECT
  TO authenticated
  USING (public.is_user_in_organization(auth.uid(), organization_id));

CREATE POLICY "Org admins can insert marker settings"
  ON public.org_marker_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin'));

CREATE POLICY "Org admins can update marker settings"
  ON public.org_marker_settings FOR UPDATE
  TO authenticated
  USING (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin'))
  WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin'));

CREATE POLICY "Org admins can delete marker settings"
  ON public.org_marker_settings FOR DELETE
  TO authenticated
  USING (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin'));

CREATE TRIGGER update_org_marker_settings_updated_at
  BEFORE UPDATE ON public.org_marker_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_org_marker_settings_org ON public.org_marker_settings(organization_id);

-- 2. Helper to resolve a numeric param with a default
CREATE OR REPLACE FUNCTION public.marker_param(p_org_id uuid, p_key text, p_param text, p_default numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(btrim(oms.params->>p_param), '')::numeric
     FROM org_marker_settings oms
     WHERE oms.organization_id = p_org_id AND oms.marker_key = p_key),
    p_default
  );
$$;

GRANT EXECUTE ON FUNCTION public.marker_param(uuid, text, text, numeric) TO authenticated, service_role;

-- 3. Parameterized recompute
CREATE OR REPLACE FUNCTION public.recompute_contact_markers(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_attend_days            int;
  v_consistent_weeks_win   int;
  v_consistent_min_weeks   int;
  v_guest_days             int;
  v_kids_days              int;
  v_missed_min_days        int;
  v_missed_max_days        int;
  v_missed_min_lifetime    int;
  v_drift_days             int;
  v_drift_min_lifetime     int;
  v_dropped_min_prior      int;
  v_group_inactive_days    int;
  v_serve_recent_days      int;
  v_serve_regular_days     int;
  v_serve_regular_min      int;
  v_stopped_lookback_days  int;
  v_stopped_min_times      int;
  v_stopped_recent_days    int;
  v_stopped_quiet_days     int;
  v_stuck_days             int;
  v_moment_days            int;
  v_online_days            int;
  v_prayer_days            int;
BEGIN
  v_attend_days           := marker_param(p_org_id, 'attended_sunday_recent', 'days', 14);
  v_consistent_weeks_win  := marker_param(p_org_id, 'consistent_attender', 'window_weeks', 4);
  v_consistent_min_weeks  := marker_param(p_org_id, 'consistent_attender', 'min_weeks', 3);
  v_guest_days            := marker_param(p_org_id, 'first_time_guest', 'days', 30);
  v_kids_days             := marker_param(p_org_id, 'kids_checked_in', 'days', 30);
  v_missed_min_days       := marker_param(p_org_id, 'missed_3_sundays', 'min_days', 21);
  v_missed_max_days       := marker_param(p_org_id, 'missed_3_sundays', 'max_days', 42);
  v_missed_min_lifetime   := marker_param(p_org_id, 'missed_3_sundays', 'min_lifetime_checkins', 4);
  v_drift_days            := marker_param(p_org_id, 'drifting_6_weeks', 'days', 42);
  v_drift_min_lifetime    := marker_param(p_org_id, 'drifting_6_weeks', 'min_lifetime_checkins', 4);
  v_dropped_min_prior     := marker_param(p_org_id, 'attendance_dropped', 'min_prior_weeks', 4);
  v_group_inactive_days   := marker_param(p_org_id, 'group_inactive_30d', 'days', 30);
  v_serve_recent_days     := marker_param(p_org_id, 'served_recently', 'days', 30);
  v_serve_regular_days    := marker_param(p_org_id, 'serves_regularly', 'days', 90);
  v_serve_regular_min     := marker_param(p_org_id, 'serves_regularly', 'min_times', 3);
  v_stopped_lookback_days := marker_param(p_org_id, 'stopped_serving', 'lookback_days', 180);
  v_stopped_min_times     := marker_param(p_org_id, 'stopped_serving', 'min_times', 3);
  v_stopped_recent_days   := marker_param(p_org_id, 'stopped_serving', 'recent_days', 90);
  v_stopped_quiet_days    := marker_param(p_org_id, 'stopped_serving', 'quiet_days', 60);
  v_stuck_days            := marker_param(p_org_id, 'stuck_in_stage_30d', 'days', 30);
  v_moment_days           := marker_param(p_org_id, 'flow_moment_recent', 'days', 90);
  v_online_days           := marker_param(p_org_id, 'watched_online_recent', 'days', 30);
  v_prayer_days           := marker_param(p_org_id, 'prayer_request_submitted', 'days', 90);

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
      COUNT(*) FILTER (WHERE checked_in_at >= NOW() - (v_attend_days * INTERVAL '1 day')) AS in_recent,
      COUNT(DISTINCT date_trunc('week', checked_in_at))
        FILTER (WHERE checked_in_at >= NOW() - ((v_consistent_weeks_win * 7) * INTERVAL '1 day')) AS weeks_consistent_win,
      COUNT(DISTINCT date_trunc('week', checked_in_at))
        FILTER (WHERE checked_in_at >= NOW() - INTERVAL '84 days') AS weeks_last_12,
      COUNT(DISTINCT date_trunc('week', checked_in_at))
        FILTER (WHERE checked_in_at >= NOW() - INTERVAL '168 days'
                  AND checked_in_at <  NOW() - INTERVAL '84 days') AS weeks_prior_12,
      COUNT(*) AS total_ever,
      COUNT(*) FILTER (WHERE checkin_kind = 'guest' AND checked_in_at >= NOW() - (v_guest_days * INTERVAL '1 day')) AS guest_recent,
      COUNT(*) FILTER (WHERE checkin_kind = 'volunteer' AND checked_in_at >= NOW() - (v_serve_recent_days * INTERVAL '1 day')) AS vol_recent,
      COUNT(*) FILTER (WHERE checkin_kind = 'volunteer' AND checked_in_at >= NOW() - (v_serve_regular_days * INTERVAL '1 day')) AS vol_regular,
      COUNT(*) FILTER (WHERE checkin_kind = 'volunteer' AND checked_in_at >= NOW() - (v_stopped_recent_days * INTERVAL '1 day')) AS vol_stopped_recent,
      COUNT(*) FILTER (WHERE checkin_kind = 'volunteer' AND checked_in_at >= NOW() - (v_stopped_lookback_days * INTERVAL '1 day')) AS vol_lookback,
      MAX(checked_in_at) FILTER (WHERE checkin_kind = 'volunteer') AS last_volunteered
    FROM own_checkins
    GROUP BY contact_id
  ),
  household_stats AS (
    SELECT contact_id, COUNT(*) AS hh_recent
    FROM household_checkins
    WHERE checked_in_at >= NOW() - (v_kids_days * INTERVAL '1 day')
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
      COUNT(*) FILTER (WHERE fm.occurred_at >= NOW() - (v_moment_days * INTERVAL '1 day')) AS moments_recent
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
      COUNT(*) FILTER (WHERE coe.created_at >= NOW() - (v_online_days * INTERVAL '1 day')) AS watch_recent,
      COUNT(*) FILTER (WHERE coe.event_type ILIKE '%prayer%' AND coe.created_at >= NOW() - (v_prayer_days * INTERVAL '1 day')) AS prayer_recent
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
      COALESCE(a.in_recent, 0)             AS in_recent,
      COALESCE(a.weeks_consistent_win, 0)  AS weeks_consistent_win,
      COALESCE(a.weeks_last_12, 0)         AS weeks_last_12,
      COALESCE(a.weeks_prior_12, 0)        AS weeks_prior_12,
      COALESCE(a.total_ever, 0)            AS total_ever,
      a.last_attended,
      COALESCE(a.guest_recent, 0)          AS guest_recent,
      COALESCE(a.vol_recent, 0)            AS vol_recent,
      COALESCE(a.vol_regular, 0)           AS vol_regular,
      COALESCE(a.vol_stopped_recent, 0)    AS vol_stopped_recent,
      COALESCE(a.vol_lookback, 0)          AS vol_lookback,
      a.last_volunteered,
      COALESCE(h.hh_recent, 0)             AS hh_recent,
      COALESCE(gar.meetings_count, 0)      AS group_meetings_count,
      COALESCE(gar.attended_count, 0)      AS group_attended_count,
      gar.last_group_attended,
      CASE WHEN EXISTS (SELECT 1 FROM group_member_rows g WHERE g.contact_id = bc.contact_id) THEN true ELSE false END AS in_group,
      fms.last_salvation,
      COALESCE(fms.moments_recent, 0)      AS moments_recent,
      COALESCE(ps.active_flows, 0)         AS active_flows,
      ps.max_days_in_stage,
      COALESCE(os.watch_recent, 0)         AS watch_recent,
      COALESCE(os.prayer_recent, 0)        AS prayer_recent
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
      FROM combined WHERE in_recent > 0
      UNION ALL
      SELECT contact_id, 'consistent_attender',
        weeks_consistent_win||' of last '||v_consistent_weeks_win||' weeks attended', weeks_consistent_win
      FROM combined WHERE weeks_consistent_win >= v_consistent_min_weeks
      UNION ALL
      SELECT contact_id, 'first_time_guest',
        'Guest check-in in last '||v_guest_days||' days', guest_recent
      FROM combined WHERE guest_recent > 0
      UNION ALL
      SELECT contact_id, 'kids_checked_in',
        hh_recent||' household check-in(s) in last '||v_kids_days||' days', hh_recent
      FROM combined WHERE hh_recent > 0
      UNION ALL
      SELECT contact_id, 'missed_3_sundays',
        'No attendance in '||v_missed_min_days||'+ days (previously regular)', NULL
      FROM combined
      WHERE total_ever >= v_missed_min_lifetime
        AND (last_attended IS NULL OR last_attended < NOW() - (v_missed_min_days * INTERVAL '1 day'))
        AND (last_attended IS NULL OR last_attended >= NOW() - (v_missed_max_days * INTERVAL '1 day'))
      UNION ALL
      SELECT contact_id, 'drifting_6_weeks',
        'No attendance in '||v_drift_days||'+ days (previously regular)', NULL
      FROM combined
      WHERE total_ever >= v_drift_min_lifetime
        AND (last_attended IS NULL OR last_attended < NOW() - (v_drift_days * INTERVAL '1 day'))
      UNION ALL
      SELECT contact_id, 'attendance_dropped',
        'Attended '||weeks_last_12||' of last 12 weeks vs '||weeks_prior_12||' of prior 12',
        weeks_prior_12 - weeks_last_12
      FROM combined
      WHERE weeks_prior_12 >= v_dropped_min_prior
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
        'In a group but no attendance in '||v_group_inactive_days||'+ days', NULL
      FROM combined
      WHERE in_group
        AND (last_group_attended IS NULL OR last_group_attended < NOW() - (v_group_inactive_days * INTERVAL '1 day'))
      UNION ALL
      SELECT contact_id, 'served_recently',
        'Served '||vol_recent||' time(s) in last '||v_serve_recent_days||' days', vol_recent
      FROM combined WHERE vol_recent > 0
      UNION ALL
      SELECT contact_id, 'serves_regularly',
        'Served '||vol_regular||' times in last '||v_serve_regular_days||' days', vol_regular
      FROM combined WHERE vol_regular >= v_serve_regular_min
      UNION ALL
      SELECT contact_id, 'stopped_serving',
        'Used to serve, none in '||v_stopped_quiet_days||'+ days', vol_lookback
      FROM combined
      WHERE vol_lookback >= v_stopped_min_times
        AND vol_stopped_recent = 0
        AND (last_volunteered IS NULL OR last_volunteered < NOW() - (v_stopped_quiet_days * INTERVAL '1 day'))
      UNION ALL
      SELECT contact_id, 'in_active_flow',
        'In '||active_flows||' active flow(s)', active_flows
      FROM combined WHERE active_flows > 0
      UNION ALL
      SELECT contact_id, 'stuck_in_stage_30d',
        ROUND(max_days_in_stage)||' days in current stage', ROUND(max_days_in_stage)
      FROM combined WHERE max_days_in_stage IS NOT NULL AND max_days_in_stage >= v_stuck_days
      UNION ALL
      SELECT contact_id, 'flow_moment_recent',
        moments_recent||' next step(s) in last '||v_moment_days||' days', moments_recent
      FROM combined WHERE moments_recent > 0
      UNION ALL
      SELECT contact_id, 'salvation_moment',
        'Salvation decision recorded', NULL
      FROM combined WHERE last_salvation IS NOT NULL
      UNION ALL
      SELECT contact_id, 'watched_online_recent',
        watch_recent||' online event(s) in last '||v_online_days||' days', watch_recent
      FROM combined WHERE watch_recent > 0
      UNION ALL
      SELECT contact_id, 'prayer_request_submitted',
        prayer_recent||' prayer request(s) in last '||v_prayer_days||' days', prayer_recent
      FROM combined WHERE prayer_recent > 0
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
  JOIN marker_definitions md ON md.key = e.key
  LEFT JOIN org_marker_settings oms
    ON oms.organization_id = p_org_id AND oms.marker_key = e.key
  WHERE COALESCE(oms.enabled, true);

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

-- 4. Catalog with per-org overrides
DROP FUNCTION IF EXISTS public.get_marker_catalog(uuid);
DROP FUNCTION IF EXISTS public.get_marker_catalog(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_marker_catalog(p_org_id uuid, p_campus_id uuid DEFAULT NULL::uuid, p_assigned_user_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  key text, label text, description text, category text, polarity text, sort_order integer,
  requires_integration text, is_phase_two boolean, contact_count bigint,
  enabled boolean, default_label text, default_description text, params jsonb, is_customized boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    md.key,
    COALESCE(NULLIF(btrim(oms.custom_label), ''), md.label) AS label,
    COALESCE(NULLIF(btrim(oms.custom_description), ''), md.description) AS description,
    md.category, md.polarity, md.sort_order,
    md.requires_integration, md.is_phase_two,
    COALESCE(c.cnt, 0) AS contact_count,
    COALESCE(oms.enabled, true) AS enabled,
    md.label AS default_label,
    md.description AS default_description,
    COALESCE(oms.params, '{}'::jsonb) AS params,
    (oms.id IS NOT NULL AND (
       oms.custom_label IS NOT NULL OR oms.custom_description IS NOT NULL
       OR oms.params <> '{}'::jsonb OR oms.enabled = false
    )) AS is_customized
  FROM marker_definitions md
  LEFT JOIN org_marker_settings oms
    ON oms.organization_id = p_org_id AND oms.marker_key = md.key
  LEFT JOIN (
    SELECT cm.marker_key, COUNT(*)::bigint AS cnt
    FROM contact_markers cm
    JOIN contacts ct ON ct.id = cm.contact_id
    WHERE cm.organization_id = p_org_id
      AND (p_campus_id IS NULL OR ct.campus_id = p_campus_id)
      AND (p_assigned_user_id IS NULL OR ct.assigned_to_user_id = p_assigned_user_id)
    GROUP BY cm.marker_key
  ) c ON c.marker_key = md.key
  WHERE EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
  )
  ORDER BY md.is_phase_two, md.category, md.sort_order;
$function$;

GRANT EXECUTE ON FUNCTION public.get_marker_catalog(uuid, uuid, uuid) TO authenticated;
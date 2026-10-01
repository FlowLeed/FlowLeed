
-- ============================================================
-- 1. signal column on contact_engagement_scores
-- ============================================================
ALTER TABLE public.contact_engagement_scores
  ADD COLUMN IF NOT EXISTS signal text;

-- ============================================================
-- 2. marker_definitions (static catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marker_definitions (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  polarity text NOT NULL CHECK (polarity IN ('positive','neutral','negative')),
  sort_order integer NOT NULL DEFAULT 100,
  requires_integration text,
  is_phase_two boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.marker_definitions TO authenticated, anon;
GRANT ALL ON public.marker_definitions TO service_role;
ALTER TABLE public.marker_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read marker definitions"
  ON public.marker_definitions FOR SELECT
  USING (true);

INSERT INTO public.marker_definitions (key, label, description, category, polarity, sort_order, requires_integration, is_phase_two) VALUES
  -- Attendance
  ('attended_sunday_recent', 'Attended Sunday recently', 'Checked in to a service in the last 14 days.', 'Attendance', 'positive', 10, NULL, false),
  ('consistent_attender', 'Consistent attender', 'Attended 3 or more of the last 4 Sundays.', 'Attendance', 'positive', 11, NULL, false),
  ('first_time_guest', 'Recent first-time guest', 'Marked as a guest in the last 30 days.', 'Attendance', 'positive', 12, NULL, false),
  ('kids_checked_in', 'Kids checked in', 'A child in this household was checked in within the last 30 days.', 'Family', 'positive', 20, NULL, false),
  ('missed_3_sundays', 'Missed last 3 Sundays', 'Hasn''t attended for 3 weeks after previously being a regular attender.', 'Attendance', 'negative', 50, NULL, false),
  ('drifting_6_weeks', 'No attendance 6+ weeks', 'Was previously active but has not attended in 6 or more weeks.', 'Attendance', 'negative', 51, NULL, false),
  ('attendance_dropped', 'Attendance dropped sharply', 'Attended much less in the last 12 weeks than in the 12 weeks before that.', 'Attendance', 'negative', 52, NULL, false),
  -- Group
  ('in_group', 'In a small group', 'Currently an active member of a small group.', 'Group', 'positive', 30, NULL, false),
  ('group_attendance_high', 'Attending group 66%+', 'Present at 66% or more of the last 8 group meetings.', 'Group', 'positive', 31, NULL, false),
  ('group_attendance_mid', 'Attending group 33%+', 'Present at 33% to 66% of recent group meetings.', 'Group', 'neutral', 32, NULL, false),
  ('group_attendance_low', 'Attending group <33%', 'Present at less than 33% of recent group meetings.', 'Group', 'negative', 53, NULL, false),
  ('group_inactive_30d', 'Group: no recent attendance', 'In a group but hasn''t attended a meeting in 30+ days.', 'Group', 'negative', 54, NULL, false),
  -- Serving
  ('served_recently', 'Served recently', 'Volunteered or served in the last 30 days.', 'Serving', 'positive', 40, NULL, false),
  ('serves_regularly', 'Serves regularly', 'Served 3 or more times in the last 90 days.', 'Serving', 'positive', 41, NULL, false),
  ('stopped_serving', 'Stopped serving', 'Used to serve regularly but hasn''t in 60+ days.', 'Serving', 'negative', 55, NULL, false),
  -- Flow / journey
  ('in_active_flow', 'In an active flow', 'Currently enrolled in one or more flows.', 'Flow', 'positive', 60, NULL, false),
  ('stuck_in_stage_30d', 'Stuck in flow stage 30+ days', 'Hasn''t moved in a flow stage for over 30 days.', 'Flow', 'negative', 61, NULL, false),
  ('flow_moment_recent', 'Recent next step', 'Took a meaningful next step (baptism, decision, etc.) in the last 90 days.', 'Journey', 'positive', 62, NULL, false),
  ('salvation_moment', 'Salvation moment recorded', 'Has a salvation decision recorded in the last 12 months.', 'Journey', 'positive', 63, NULL, false),
  -- Online
  ('watched_online_recent', 'Watched online recently', 'Joined a Church Online event in the last 30 days.', 'Online', 'positive', 70, NULL, false),
  ('prayer_request_submitted', 'Submitted prayer request', 'Submitted a prayer request through Church Online in the last 90 days.', 'Online', 'positive', 71, NULL, false),
  -- Phase 2 (require integrations not yet built)
  ('giving_recent', 'Giving in last 90 days', 'Has given financially in the last 90 days.', 'Giving', 'positive', 80, 'pco_giving', true),
  ('stopped_giving', 'Stopped giving', 'Used to give regularly but hasn''t in 90+ days.', 'Giving', 'negative', 81, 'pco_giving', true),
  ('scheduled_to_serve', 'Scheduled to serve', 'Has an upcoming serving assignment.', 'Serving', 'positive', 82, 'pco_services', true),
  ('registered_for_event', 'Registered for event', 'Registered for an upcoming event.', 'Event', 'positive', 83, 'pco_registrations', true),
  ('attended_event', 'Attended event recently', 'Attended a registered event in the last 90 days.', 'Event', 'positive', 84, 'pco_registrations', true)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  polarity = EXCLUDED.polarity,
  sort_order = EXCLUDED.sort_order,
  requires_integration = EXCLUDED.requires_integration,
  is_phase_two = EXCLUDED.is_phase_two;

-- ============================================================
-- 3. contact_markers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contact_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  marker_key text NOT NULL REFERENCES public.marker_definitions(key) ON DELETE CASCADE,
  polarity text NOT NULL,
  value_text text,
  value_numeric numeric,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, marker_key)
);

CREATE INDEX IF NOT EXISTS contact_markers_contact_idx ON public.contact_markers (contact_id);
CREATE INDEX IF NOT EXISTS contact_markers_org_key_idx ON public.contact_markers (organization_id, marker_key);
CREATE INDEX IF NOT EXISTS contact_markers_polarity_idx ON public.contact_markers (organization_id, polarity);

GRANT SELECT ON public.contact_markers TO authenticated;
GRANT ALL ON public.contact_markers TO service_role;
ALTER TABLE public.contact_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read markers"
  ON public.contact_markers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contact_markers.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. recompute_contact_markers
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_contact_markers(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- wipe org's markers and rebuild
  DELETE FROM public.contact_markers WHERE organization_id = p_org_id;

  WITH
  -- ---------- shared household / person mapping (mirrors engagement scorer) ----------
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
  -- household-attributed checkins (for the kids_checked_in marker)
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
  -- ---------- groups ----------
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
    -- last 8 meetings per group
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
     AND ga.meeting_id = rgm.meeting_id
    GROUP BY gmr.contact_id
  ),
  -- ---------- flow moments / journey ----------
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
  -- ---------- pipelines ----------
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
  -- ---------- church online ----------
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
  -- ---------- universe of contacts to evaluate ----------
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
  -- ---------- emit markers ----------
  emitted AS (
    SELECT contact_id, key, value_text, value_numeric FROM (
      -- Attendance positives
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
      -- Attendance negatives
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
        AND weeks_last_12 < weeks_prior_12  -- ensures real drop
      -- Groups
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
      -- Serving
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
      -- Flow / journey
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
      -- Online
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

  -- ---------- derive signal level per contact ----------
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
$$;

-- ============================================================
-- 5. extend calculate_engagement_scores to also compute markers
-- ============================================================
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

-- ============================================================
-- 6. RPCs for app
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_contact_signal(p_contact_id uuid)
RETURNS TABLE (
  signal text,
  engagement_level text,
  score integer,
  marker_key text,
  label text,
  description text,
  category text,
  polarity text,
  value_text text,
  value_numeric numeric,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ces.signal,
    ces.engagement_level,
    ces.score,
    md.key,
    md.label,
    md.description,
    md.category,
    md.polarity,
    cm.value_text,
    cm.value_numeric,
    md.sort_order
  FROM contacts c
  LEFT JOIN contact_engagement_scores ces ON ces.contact_id = c.id
  LEFT JOIN contact_markers cm ON cm.contact_id = c.id
  LEFT JOIN marker_definitions md ON md.key = cm.marker_key
  WHERE c.id = p_contact_id
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = c.organization_id AND om.user_id = auth.uid()
    )
  ORDER BY
    CASE md.polarity WHEN 'positive' THEN 1 WHEN 'neutral' THEN 2 WHEN 'negative' THEN 3 ELSE 4 END,
    md.sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.get_contact_signal(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_marker_catalog(p_org_id uuid)
RETURNS TABLE (
  key text,
  label text,
  description text,
  category text,
  polarity text,
  sort_order integer,
  requires_integration text,
  is_phase_two boolean,
  contact_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    md.key, md.label, md.description, md.category, md.polarity, md.sort_order,
    md.requires_integration, md.is_phase_two,
    COALESCE(c.cnt, 0) AS contact_count
  FROM marker_definitions md
  LEFT JOIN (
    SELECT marker_key, COUNT(*)::bigint AS cnt
    FROM contact_markers
    WHERE organization_id = p_org_id
    GROUP BY marker_key
  ) c ON c.marker_key = md.key
  WHERE EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
  )
  ORDER BY md.is_phase_two, md.category, md.sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.get_marker_catalog(uuid) TO authenticated;

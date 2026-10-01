
-- Table: pco_checkins
CREATE TABLE public.pco_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  pc_person_id text NOT NULL,
  event_name text,
  event_time_name text,
  location_name text,
  checkin_kind text DEFAULT 'regular',
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  pco_checkin_id text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for dedup
ALTER TABLE public.pco_checkins ADD CONSTRAINT pco_checkins_pco_checkin_id_key UNIQUE (pco_checkin_id);

-- Index for fast lookups
CREATE INDEX idx_pco_checkins_org_id ON public.pco_checkins(organization_id);
CREATE INDEX idx_pco_checkins_contact_id ON public.pco_checkins(contact_id);
CREATE INDEX idx_pco_checkins_pc_person_id ON public.pco_checkins(pc_person_id);
CREATE INDEX idx_pco_checkins_checked_in_at ON public.pco_checkins(checked_in_at);

-- RLS
ALTER TABLE public.pco_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view checkins in their org"
  ON public.pco_checkins FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = pco_checkins.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert checkins in their org"
  ON public.pco_checkins FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = pco_checkins.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Service role bypass for edge functions
CREATE POLICY "Service role full access to pco_checkins"
  ON public.pco_checkins FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Table: contact_engagement_scores
CREATE TABLE public.contact_engagement_scores (
  contact_id uuid PRIMARY KEY REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  total_checkins_90d integer DEFAULT 0,
  total_checkins_30d integer DEFAULT 0,
  weeks_attended_last_12 integer DEFAULT 0,
  last_checkin_at timestamptz,
  engagement_level text DEFAULT 'new',
  streak_weeks integer DEFAULT 0,
  volunteer_checkins_90d integer DEFAULT 0,
  score integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_engagement_scores_org ON public.contact_engagement_scores(organization_id);
CREATE INDEX idx_engagement_scores_level ON public.contact_engagement_scores(engagement_level);

-- RLS
ALTER TABLE public.contact_engagement_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view engagement scores in their org"
  ON public.contact_engagement_scores FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contact_engagement_scores.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to engagement_scores"
  ON public.contact_engagement_scores FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- DB function: calculate_engagement_scores
CREATE OR REPLACE FUNCTION public.calculate_engagement_scores(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_score integer;
  v_level text;
  v_total_ever integer;
  v_freq_score numeric;
  v_recency_score numeric;
  v_streak_score numeric;
  v_volunteer_score numeric;
  v_days_since numeric;
BEGIN
  FOR r IN
    SELECT
      c.id AS contact_id,
      c.organization_id,
      -- 90d checkins
      COALESCE(SUM(CASE WHEN pc.checked_in_at >= NOW() - INTERVAL '90 days' THEN 1 ELSE 0 END), 0) AS total_90d,
      -- 30d checkins
      COALESCE(SUM(CASE WHEN pc.checked_in_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END), 0) AS total_30d,
      -- Total ever
      COUNT(pc.id) AS total_ever,
      -- Last checkin
      MAX(pc.checked_in_at) AS last_checkin,
      -- Distinct weeks in last 12 weeks
      COUNT(DISTINCT EXTRACT(WEEK FROM pc.checked_in_at) * 100 + EXTRACT(YEAR FROM pc.checked_in_at))
        FILTER (WHERE pc.checked_in_at >= NOW() - INTERVAL '84 days') AS weeks_12,
      -- Volunteer checkins in 90d
      COALESCE(SUM(CASE WHEN pc.checkin_kind = 'volunteer' AND pc.checked_in_at >= NOW() - INTERVAL '90 days' THEN 1 ELSE 0 END), 0) AS vol_90d
    FROM contacts c
    LEFT JOIN pco_checkins pc ON pc.contact_id = c.id
    WHERE c.organization_id = p_org_id
      AND EXISTS (SELECT 1 FROM pco_checkins pc2 WHERE pc2.contact_id = c.id)
    GROUP BY c.id, c.organization_id
  LOOP
    -- Frequency score (40 pts): weeks_12 / 12 * 40
    v_freq_score := LEAST((r.weeks_12::numeric / 12.0) * 40, 40);

    -- Recency score (25 pts)
    IF r.last_checkin IS NOT NULL THEN
      v_days_since := EXTRACT(EPOCH FROM (NOW() - r.last_checkin)) / 86400.0;
      v_recency_score := GREATEST(25 - (v_days_since / 90.0 * 25), 0);
    ELSE
      v_recency_score := 0;
    END IF;

    -- Streak score (20 pts) - approximate: consecutive recent weeks
    -- Simple approximation: if weeks_12 >= 10 → 20, >= 6 → 12, >= 3 → 6, else weeks*2
    v_streak_score := LEAST(r.weeks_12 * 2, 20);

    -- Volunteer score (15 pts)
    v_volunteer_score := LEAST(r.vol_90d * 3, 15);

    v_score := ROUND(v_freq_score + v_recency_score + v_streak_score + v_volunteer_score)::integer;
    v_score := LEAST(v_score, 100);

    -- Determine level
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
      r.contact_id, r.organization_id, r.total_90d, r.total_30d,
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
$$;

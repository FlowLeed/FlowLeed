
-- 1. Snapshots table
CREATE TABLE IF NOT EXISTS public.org_engagement_snapshots (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  engagement_level text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, snapshot_date, engagement_level)
);

CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_org_date
  ON public.org_engagement_snapshots (organization_id, snapshot_date DESC);

ALTER TABLE public.org_engagement_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view engagement snapshots" ON public.org_engagement_snapshots;
CREATE POLICY "Org members can view engagement snapshots"
  ON public.org_engagement_snapshots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = org_engagement_snapshots.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.is_system_admin(auth.uid())
  );

-- 2. Snapshot writer: aggregate current contact_engagement_scores into today's row per org/level
CREATE OR REPLACE FUNCTION public.snapshot_engagement_distribution_all()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  WITH agg AS (
    SELECT organization_id, engagement_level::text AS engagement_level, COUNT(*)::int AS count
    FROM public.contact_engagement_scores
    GROUP BY organization_id, engagement_level
  ),
  ins AS (
    INSERT INTO public.org_engagement_snapshots (organization_id, snapshot_date, engagement_level, count)
    SELECT organization_id, CURRENT_DATE, engagement_level, count FROM agg
    ON CONFLICT (organization_id, snapshot_date, engagement_level)
    DO UPDATE SET count = EXCLUDED.count, created_at = now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO inserted_count FROM ins;
  RETURN inserted_count;
END;
$$;

-- 3. Read most recent snapshot at-or-before a given date (within 7-day lookback window)
CREATE OR REPLACE FUNCTION public.get_engagement_snapshot(p_org_id uuid, p_as_of date)
RETURNS TABLE(engagement_level text, count integer, snapshot_date date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH access_check AS (
    SELECT 1
    WHERE EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
    )
    OR public.is_system_admin(auth.uid())
  ),
  latest AS (
    SELECT MAX(snapshot_date) AS d
    FROM public.org_engagement_snapshots
    WHERE organization_id = p_org_id
      AND snapshot_date <= p_as_of
      AND snapshot_date >= p_as_of - INTERVAL '7 days'
  )
  SELECT s.engagement_level, s.count, s.snapshot_date
  FROM public.org_engagement_snapshots s, latest, access_check
  WHERE s.organization_id = p_org_id
    AND s.snapshot_date = latest.d;
$$;

-- 4. Read daily series for sparklines
CREATE OR REPLACE FUNCTION public.get_engagement_snapshot_series(p_org_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE(snapshot_date date, engagement_level text, count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.snapshot_date, s.engagement_level, s.count
  FROM public.org_engagement_snapshots s
  WHERE s.organization_id = p_org_id
    AND s.snapshot_date >= CURRENT_DATE - (p_days || ' days')::interval
    AND (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
      )
      OR public.is_system_admin(auth.uid())
    )
  ORDER BY s.snapshot_date ASC;
$$;

-- 5. Schedule daily snapshot at 03:00 UTC
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('snapshot-engagement-distribution-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'snapshot-engagement-distribution-daily',
  '0 3 * * *',
  $$ SELECT public.snapshot_engagement_distribution_all(); $$
);

-- 6. Seed today's snapshot immediately so the UI has something to compare against
SELECT public.snapshot_engagement_distribution_all();

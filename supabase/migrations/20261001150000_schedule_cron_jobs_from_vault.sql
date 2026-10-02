-- Schedules every pg_cron job from version control. Until now the jobs only existed in
-- production (created through migrations that are now archived, or the SQL editor), with the
-- production URL, API key and cron secret written into each command.
--
-- Each job now reads its target and credentials from Vault when it runs, so the same jobs work
-- locally, on staging and in production. Every environment needs these Vault secrets
-- (seed.sql creates the local ones; see supabase/README.md for hosted projects):
--   project_url  https://<project-ref>.supabase.co (locally http://host.docker.internal:54321)
--   cron_secret  the same value as the CRON_SECRET Edge Function secret
--
-- The called functions check the x-cron-secret header themselves (_shared/cron-auth.ts) and
-- have verify_jwt = false in config.toml, so no API key is sent.
--
-- cron.schedule() replaces a job that has the same name, so on production this swaps the
-- hard-coded commands for the ones below and keeps the existing schedules.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.invoke_edge_function(p_function text, p_body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_project_url text;
  v_cron_secret text;
BEGIN
  SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO v_cron_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';

  -- Fail loudly: the error shows up in cron.job_run_details instead of a silent skip.
  IF v_project_url IS NULL OR v_cron_secret IS NULL THEN
    RAISE EXCEPTION 'Vault secrets project_url and cron_secret are required to call Edge Function %', p_function;
  END IF;

  RETURN net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/' || p_function,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_cron_secret
    ),
    body := p_body
  );
END;
$$;

REVOKE ALL ON FUNCTION private.invoke_edge_function(text, jsonb) FROM PUBLIC;

-- Edge Functions
SELECT cron.schedule('content-retry-failed-every-10min', '*/10 * * * *',
  $$SELECT private.invoke_edge_function('content-retry-failed')$$);
SELECT cron.schedule('pco-checkin-auto-sync', '30 */6 * * *',
  $$SELECT private.invoke_edge_function('pco-checkin-auto-sync')$$);
SELECT cron.schedule('pco-groups-auto-sync', '45 */6 * * *',
  $$SELECT private.invoke_edge_function('pco-groups-auto-sync')$$);
SELECT cron.schedule('pco-sync-processor', '* * * * *',
  $$SELECT private.invoke_edge_function('pco-sync-processor')$$);
SELECT cron.schedule('pco-token-refresh-daily', '30 3 * * *',
  $$SELECT private.invoke_edge_function('pco-token-refresh-cron', '{"source": "cron"}'::jsonb)$$);
SELECT cron.schedule('pco-user-permissions-daily', '0 4 * * *',
  $$SELECT private.invoke_edge_function('pco-sync-user-permissions-cron')$$);
SELECT cron.schedule('planning-center-auto-sync', '*/15 * * * *',
  $$SELECT private.invoke_edge_function('planning-center-lists', '{"action": "autoSync"}'::jsonb)$$);
SELECT cron.schedule('recompute-markers-daily', '30 4 * * *',
  $$SELECT private.invoke_edge_function('recompute-markers-cron')$$);
SELECT cron.schedule('recurring-flow-processor-daily', '0 2 * * *',
  $$SELECT private.invoke_edge_function('recurring-flow-processor')$$);
SELECT cron.schedule('send-daily-digest', '0 8 * * *',
  $$SELECT private.invoke_edge_function('send-daily-digest', '{"time": "now"}'::jsonb)$$);

-- Database only
SELECT cron.schedule('cleanup-cron-history', '0 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$);
SELECT cron.schedule('remind-open-life-seasons', '30 8 * * *',
  $$SELECT public.remind_open_life_seasons()$$);
SELECT cron.schedule('snapshot-engagement-distribution-daily', '0 3 * * *',
  $$SELECT public.snapshot_engagement_distribution_all()$$);

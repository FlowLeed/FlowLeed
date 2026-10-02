
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Replace any previous schedule with same name
SELECT cron.unschedule('pco-user-permissions-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pco-user-permissions-daily');

SELECT cron.schedule(
  'pco-user-permissions-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lghamvpolwebtjwaxned.supabase.co/functions/v1/pco-sync-user-permissions-cron',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnaGFtdnBvbHdlYnRqd2F4bmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MjE0OTEsImV4cCI6MjA3MTQ5NzQ5MX0.yrtGMayjKCu0-K41XWanNe7U3zM0z39cK1fy1OgN7E4"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  ) AS request_id;
  $$
);

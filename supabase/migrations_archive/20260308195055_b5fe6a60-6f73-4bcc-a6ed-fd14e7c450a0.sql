
-- Enable pg_cron and pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule cron job for check-in auto-sync every 6 hours
SELECT cron.schedule(
  'pco-checkin-auto-sync',
  '30 */6 * * *',
  $$
  SELECT net.http_post(
    url:='https://lghamvpolwebtjwaxned.supabase.co/functions/v1/pco-checkin-auto-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnaGFtdnBvbHdlYnRqd2F4bmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MjE0OTEsImV4cCI6MjA3MTQ5NzQ5MX0.yrtGMayjKCu0-K41XWanNe7U3zM0z39cK1fy1OgN7E4"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

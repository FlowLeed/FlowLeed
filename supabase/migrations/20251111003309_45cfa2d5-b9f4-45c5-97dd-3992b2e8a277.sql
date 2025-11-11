-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if it exists (to make this migration idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('recurring-flow-processor-daily');
EXCEPTION
  WHEN undefined_table THEN
    -- pg_cron not installed yet, skip
    NULL;
  WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
    NULL;
END $$;

-- Schedule the recurring flow processor to run daily at 2 AM UTC
SELECT cron.schedule(
  'recurring-flow-processor-daily',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$
  SELECT net.http_post(
    url:='https://lghamvpolwebtjwaxned.supabase.co/functions/v1/recurring-flow-processor',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnaGFtdnBvbHdlYnRqd2F4bmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MjE0OTEsImV4cCI6MjA3MTQ5NzQ5MX0.yrtGMayjKCu0-K41XWanNe7U3zM0z39cK1fy1OgN7E4"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
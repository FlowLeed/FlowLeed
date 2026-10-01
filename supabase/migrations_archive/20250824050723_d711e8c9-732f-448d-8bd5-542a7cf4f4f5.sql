-- Move pg_cron and pg_net extensions from public to extensions schema
DROP EXTENSION IF EXISTS pg_cron;
DROP EXTENSION IF EXISTS pg_net;

-- Install extensions in the proper schema
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Recreate the cron job with proper extension references
SELECT extensions.cron.schedule(
  'planning-center-auto-sync',
  '* * * * *', -- every minute
  $$
  SELECT
    extensions.net.http_post(
        url:='https://lghamvpolwebtjwaxned.supabase.co/functions/v1/planning-center-lists',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnaGFtdnBvbHdlYnRqd2F4bmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MjE0OTEsImV4cCI6MjA3MTQ5NzQ5MX0.yrtGMayjKCu0-K41XWanNe7U3zM0z39cK1fy1OgN7E4"}'::jsonb,
        body:='{"action": "autoSync"}'::jsonb
    ) as request_id;
  $$
);
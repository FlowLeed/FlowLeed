-- Drop and recreate extensions properly
DROP EXTENSION IF EXISTS pg_cron CASCADE;
DROP EXTENSION IF EXISTS pg_net CASCADE;

-- Install extensions without specifying schema (they'll go to public but that's standard)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the cron job with standard references
SELECT cron.schedule(
  'planning-center-auto-sync',
  '* * * * *', -- every minute
  $$
  SELECT
    net.http_post(
        url:='https://lghamvpolwebtjwaxned.supabase.co/functions/v1/planning-center-lists',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnaGFtdnBvbHdlYnRqd2F4bmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MjE0OTEsImV4cCI6MjA3MTQ5NzQ5MX0.yrtGMayjKCu0-K41XWanNe7U3zM0z39cK1fy1OgN7E4"}'::jsonb,
        body:='{"action": "autoSync"}'::jsonb
    ) as request_id;
  $$
);
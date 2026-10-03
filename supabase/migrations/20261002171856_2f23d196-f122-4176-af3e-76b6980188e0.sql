SELECT cron.unschedule('care-agent-daily');
SELECT cron.schedule('care-agent-daily', '0 12,13,14 * * *', $$
  SELECT net.http_post(
    url := 'https://lghamvpolwebtjwaxned.supabase.co/functions/v1/care-agent-run',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnaGFtdnBvbHdlYnRqd2F4bmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MjE0OTEsImV4cCI6MjA3MTQ5NzQ5MX0.yrtGMayjKCu0-K41XWanNe7U3zM0z39cK1fy1OgN7E4"}'::jsonb,
    body := '{"source":"cron"}'::jsonb) AS request_id; $$);
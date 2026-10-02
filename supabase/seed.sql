-- Local-only data. Runs on `supabase db reset` and the first `supabase start`, never on hosted
-- projects. Schema, storage buckets and cron jobs are in supabase/migrations/.

-- Vault secrets the pg_cron jobs read (local values only; each hosted project sets its own,
-- see supabase/README.md). host.docker.internal reaches the host's Supabase API (port 54321) from
-- inside the Postgres container.
select vault.create_secret('http://host.docker.internal:54321', 'project_url');
-- Must match CRON_SECRET in supabase/functions/.env.local.
select vault.create_secret('local-cron-secret', 'cron_secret');

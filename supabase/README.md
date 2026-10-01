# Supabase: database, cron jobs and secrets

This page covers four things for the Supabase side of FlowLeed:
- how it is put together;
- how the local database was rebuilt from production;
- what each environment (local, staging, production) needs;
- what is still to do before CI/CD deploys it.

For running the whole app locally, see [How to run the demo](../README.md#how-to-run-the-demo) in the main README.

## What's in this folder

| Path | What it is |
|---|---|
| `config.toml` | Local stack settings, plus `verify_jwt` for each Edge Function (used by `supabase functions serve` and `supabase functions deploy`). |
| `migrations/20260930000000_baseline.sql` | The whole production schema as one migration. Every environment starts from here. |
| `migrations/20261001140000_storage_buckets_and_policies.sql` | The five storage buckets and the 20 `storage.objects` policies. |
| `migrations/20261001150000_schedule_cron_jobs_from_vault.sql` | The 13 pg_cron jobs, and the helper they use to call Edge Functions. |
| `migrations/20261001160000_push_notifications_from_vault.sql` | Points the push-notification trigger at the right project, using the same helper and Vault secrets. |
| `migrations_archive/` | The 233 original Lovable migrations, unchanged, kept for history. **Never applied.** |
| `seed.sql` | Local-only: the local Vault values. Runs on `supabase db reset` and the first `supabase start`, never on hosted projects. |
| `functions/` | Edge Functions (Deno). Each one has its own `deno.json` with pinned dependencies. |
| `functions/_shared/cron-auth.ts` | The check every cron-called function runs on the `x-cron-secret` header. |
| `functions/.env.example` | Names of the Edge Function secrets. Copy to `functions/.env.local` for local development. |

## How the local database was rebuilt from production

The 233 Lovable migrations couldn't build a database from scratch, for two reasons:
- seven tables they depend on were never created in any migration;
- one migration stops when a Vault secret is missing.

So we rebuilt from production in six steps. Each step fixed something the previous one didn't capture.

### 1. Schema: one baseline migration

We took a **schema-only dump of production** and saved it as `migrations/20260930000000_baseline.sql`. The original migrations moved, unchanged, to `migrations_archive/`. The dump covers the `public` schema: tables, views, functions, triggers, RLS policies and grants. It includes no data.

### 2. Storage buckets and their access rules

Storage lives in the `storage` schema, which the dump doesn't include. It needs:
- the five buckets: `avatars`, `group-images`, `story-media`, `org-logos` and `content-thumbnails`;
- the 20 `storage.objects` policies that control who can read and write each bucket.

We first recreated them in `seed.sql`. They then moved to `migrations/20261001140000_storage_buckets_and_policies.sql`, because hosted projects need them and `supabase db push` never runs `seed.sql`.

The migration is safe to run where they already exist, as in production:
- buckets are only inserted when missing;
- each policy is only created when no policy with that name exists.

Existing buckets and policies are left exactly as they are. To change a policy later, drop and recreate it in a new migration.

### 3. Auth trigger

The trigger that runs when someone signs up sits on `auth.users`, which is outside the dump too. We added it by hand at the end of the baseline:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

`handle_new_user()` creates the new user's profile and organization. It also picks an organization slug from the sign-up details.

### 4. Cron jobs

pg_cron stores jobs as **rows** in `cron.job`, so a schema dump doesn't include them, and locally nothing ran. We pulled the 13 jobs from production on October 1, 2026 and recreated them in `migrations/20261001150000_schedule_cron_jobs_from_vault.sql`. They keep the same names and schedules.

In production, every job had the production URL and an API key or cron secret written into its command. The migration replaces that with one helper, `private.invoke_edge_function(function, body)`, which:
- reads the project URL and the cron secret from Vault when the job runs;
- calls the Edge Function with the secret in an `x-cron-secret` header;
- fails with a clear error in `cron.job_run_details` if either Vault secret is missing.

`cron.schedule()` replaces a job with the same name. So on production, this migration swaps the hard-coded commands for the new ones and keeps the schedules.

| Job | Schedule (UTC) | Runs |
|---|---|---|
| `pco-sync-processor` | every minute | Edge Function `pco-sync-processor` |
| `content-retry-failed-every-10min` | every 10 min | Edge Function `content-retry-failed` |
| `planning-center-auto-sync` | every 15 min | Edge Function `planning-center-lists` (`autoSync`) |
| `pco-checkin-auto-sync` | 00:30, 06:30, 12:30, 18:30 | Edge Function `pco-checkin-auto-sync` |
| `pco-groups-auto-sync` | 00:45, 06:45, 12:45, 18:45 | Edge Function `pco-groups-auto-sync` |
| `recurring-flow-processor-daily` | 02:00 | Edge Function `recurring-flow-processor` |
| `cleanup-cron-history` | 03:00 | SQL: deletes cron run history older than 7 days |
| `snapshot-engagement-distribution-daily` | 03:00 | SQL: `public.snapshot_engagement_distribution_all()` |
| `pco-token-refresh-daily` | 03:30 | Edge Function `pco-token-refresh-cron` |
| `pco-user-permissions-daily` | 04:00 | Edge Function `pco-sync-user-permissions-cron` |
| `recompute-markers-daily` | 04:30 | Edge Function `recompute-markers-cron` |
| `send-daily-digest` | 08:00 | Edge Function `send-daily-digest` |
| `remind-open-life-seasons` | 08:30 | SQL: `public.remind_open_life_seasons()` |

### 5. Vault secrets

The cron jobs, and the push-notification trigger, read URLs and secrets from Supabase Vault. Vault contents are data, not schema, so the dump didn't include them either.

Secret **values never go in a migration**, for two reasons:
- migrations are committed to git;
- migrations run unchanged in every environment, but each environment needs different values.

So:
- migrations only refer to a secret **by name**;
- `seed.sql` creates the **local** values;
- each **hosted** project gets its values once, by hand. See [Secrets per environment](#secrets-per-environment).

### 6. Every cron-called function checks the cron secret

Before this change, most functions that cron calls didn't check who was calling. They use the service-role key internally, and five of them had the gateway's JWT check turned off. Anyone who knew the URL could trigger a Planning Center sync or send the daily digest.

Now each one checks the `x-cron-secret` header with `_shared/cron-auth.ts`:
- **Fails closed.** If `CRON_SECRET` isn't set, every request is refused. `pco-sync-user-permissions-cron` used to let every request through in that case.
- **Gateway JWT check off.** All ten functions have `verify_jwt = false` in `config.toml`, because the secret is their authentication. Five of them had no entry before, which means the CLI would have deployed them with `verify_jwt = true`.

| Function | Who may call it |
|---|---|
| `content-retry-failed`, `pco-checkin-auto-sync`, `pco-groups-auto-sync`, `pco-token-refresh-cron`, `pco-sync-user-permissions-cron`, `recompute-markers-cron`, `recurring-flow-processor`, `send-daily-digest` | Cron only |
| `pco-sync-processor` | Cron, or a signed-in user. The app calls it right after a Planning Center mapping is saved. |
| `planning-center-lists` | Cron for the `autoSync` action only. Every other action already requires a signed-in user. |
| `send-push` | The push-notification trigger in the database, and `send-test-push`. See step 7. |

### 7. Push notifications

When a row is inserted into `public.notifications`, the trigger `trg_notify_push_on_notification` runs `notify_push_on_notification()`. That function calls the `send-push` Edge Function to send a browser push.

As dumped from production, it had two problems:
- **Production's URL was written into it,** so every environment pushed through production. Locally and on staging it skipped silently, because it also needed a `service_role_key` Vault secret.
- **`send-push` accepted any JWT for the project,** including the public anon key built into the web app. Anyone could push any message to any user.

`migrations/20261001160000_push_notifications_from_vault.sql` fixes both:
- The trigger now calls `send-push` through `private.invoke_edge_function()`, like the cron jobs.
- `send-push` checks the cron secret and has `verify_jwt = false`. `send-test-push` sends the secret when it calls `send-push`.
- A push that can't be sent is logged as a warning. It never stops the notification from being saved.

The `service_role_key` Vault secret is no longer used.

## Secrets per environment

| Secret | Kind | Used by | Local value | Staging and production |
|---|---|---|---|---|
| `project_url` | Vault | Cron jobs and push notifications | `http://host.docker.internal:54321` (from `seed.sql`) | `https://<project-ref>.supabase.co` |
| `cron_secret` | Vault | Cron jobs and push notifications | `local-cron-secret` (from `seed.sql`) | A long random value, **identical to `CRON_SECRET`** |
| `CRON_SECRET` | Edge Function secret | The 10 cron-called functions and `send-push` | `local-cron-secret` in `functions/.env.local` | `supabase secrets set CRON_SECRET=…` |

`host.docker.internal` is how the Postgres container reaches the Supabase API on your machine. From inside the container, `localhost` would mean the container itself.

**Hosted project, once per project.** Run this in its SQL editor. Use the same random value for `cron_secret` and `CRON_SECRET`.

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<long random value>', 'cron_secret');
```

```bash
supabase secrets set CRON_SECRET=<same long random value> --project-ref <project-ref>
```

**Rotating the cron secret** means changing both values at the same time:

```sql
select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<new value>');
```

```bash
supabase secrets set CRON_SECRET=<new value> --project-ref <project-ref>
```

## Working locally

| Task | Command | Notes |
|---|---|---|
| Start the stack | `supabase start` | On first start, it applies all migrations and `seed.sql`. |
| Apply new migrations, keep your data | `supabase migration up` | |
| Rebuild from scratch | `supabase db reset` | **Deletes all local data.** Then reapplies migrations and `seed.sql`. |
| Run Edge Functions with your local secrets | `supabase functions serve --env-file supabase/functions/.env.local` | |

`CRON_SECRET` in `functions/.env.local` must be `local-cron-secret`, the Vault value from `seed.sql`. Otherwise every cron call and push gets a 401.

The functions that `supabase start` serves on its own don't read `functions/.env.local`, so they have no `CRON_SECRET` and refuse those calls too. Run `supabase functions serve --env-file supabase/functions/.env.local` whenever you need cron jobs or push notifications locally.

To check the cron jobs, run these in Studio (http://127.0.0.1:54323) or psql:

```sql
select jobname, schedule, active from cron.job order by jobname;
select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
select id, status_code, content, error_msg from net._http_response order by id desc limit 10;
```

`pco-sync-processor` runs every minute, so you'll see it in the functions terminal once a minute.

## Making changes

- **Schema change:**
  - run `supabase migration new <name>` and write the SQL there;
  - never edit the baseline, `migrations_archive/` or a migration that has already run on a hosted project.
- **New scheduled job:** in a new migration:
  ```sql
  select cron.schedule('<job-name>', '<cron expression>',
    $$select private.invoke_edge_function('<function-name>', '{}'::jsonb)$$);
  ```
- **New function called by cron:**
  - start the handler with `rejectUnlessCron(req, corsHeaders)` from `_shared/cron-auth.ts`;
  - add `[functions.<name>] verify_jwt = false` to `config.toml`.
- **New secret:**
  - for an Edge Function secret, add its name to `functions/.env.example`;
  - for a Vault secret, add its local value to `seed.sql` and a row to the table above.

## Before merging to `dev` and turning on CI/CD

The staging pipeline is set up. See [DEPLOYMENT.md](../DEPLOYMENT.md). Every push to `dev`:
1. builds the app;
2. applies new migrations to the staging project;
3. sets the Edge Function secrets and deploys the functions;
4. publishes the app on Cloudflare.

**Done:**
- **Storage moved to a migration.** The storage buckets and policies moved from `seed.sql` to a migration. `seed.sql` holds only local values, and CI never runs it.
- **Functions deploy with the migrations.** Edge Functions deploy in the same run, right after the migrations, so the new cron jobs and the functions' secret check go live together.

**Before the first deploy to staging:**

1. **Create the Vault secrets and the GitHub secrets and variables.** See [DEPLOYMENT.md](../DEPLOYMENT.md#one-time-setup), steps 2 and 5. Without the Vault secrets, every cron job fails with "Vault secrets project_url and cron_secret are required…", and push notifications aren't sent.

**Before turning on production:**

2. **Repair production's migration history** once, before the first `db push` to production:
   - mark the baseline as applied: `supabase migration repair --status applied 20260930000000`;
   - mark the archived versions as reverted, if `supabase migration list` shows them.
   - `supabase db diff --linked` should then show no differences.
3. **Rotate the production cron secret.**
   - The current value is written in plain text in production's cron commands and run history, and it was shared in a chat.
   - Creating the new `cron_secret` and `CRON_SECRET` with a new value is the rotation.
   - Once the new jobs are running, delete the old `pco_cron_secret` Vault entry, and the `service_role_key` entry, which is no longer used.
4. **Check `verify_jwt` for the other functions.**
   - `config.toml` now lists 44 of the 74 functions. The CLI deploys the other 30 with `verify_jwt = true`.
   - Compare with production's current settings first.
5. **Compare production's storage policies** with the migration. Run `select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects';`.
   - The migration only adds policies that are missing by name, and leaves the rest alone.
   - All 20 names also appear in the archived Lovable migrations, so production most likely has them all.
6. **Expect a few minutes of 401s.** The migrations and the function deploy run a few minutes apart. In that gap, cron calls to the five functions that were missing from `config.toml` may get a 401, and pushes may fail. Cron calls succeed on the next run, and the notifications themselves are still saved.

### Known issues

- **Sign-up with a reserved word fails.** `handle_new_user()` builds the organization slug from the sign-up details. When that slug is a reserved word, such as `admin`, the reserved-slug check rejects it and sign-up fails, for example for `admin@yourchurch.org`. Locally, use an address like `pastor@example.com`.
- **Existing type errors.** `deno check` reports type errors in five functions: `send-push` (7), `pco-sync-processor` (5), `pco-sync-user-permissions-cron` (2), `recurring-flow-processor` (1) and `send-daily-digest` (1). Deploys don't type-check, so they don't block anything.

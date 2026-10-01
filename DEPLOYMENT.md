# Deployment

Every push to the `dev` branch deploys FlowLeed to **staging**. The workflow is [`.github/workflows/deploy-staging.yml`](.github/workflows/deploy-staging.yml). You can also start it by hand: **Actions → Deploy to staging → Run workflow**.

Production isn't wired up yet. See [Adding production](#adding-production).

## What the pipeline does

Three jobs run in order. A failed job stops the ones after it.

| # | Job | What it does |
|---|---|---|
| 1 | **Build web app** | 1. Installs dependencies from `bun.lock`.<br/>2. Type-checks the app.<br/>3. Builds it with Vite, using the staging Supabase URL and key.<br/><br/>Nothing has been deployed yet, so a broken build leaves staging untouched. |
| 2 | **Migrate database and deploy Edge Functions** | 1. Links the staging Supabase project.<br/>2. Runs `supabase db push`.<br/>3. Sets the Edge Function secrets.<br/>4. Runs `supabase functions deploy`. |
| 3 | **Deploy web app to Cloudflare** | Publishes the build from job 1 to Cloudflare Workers with `wrangler deploy --env staging`. |

The web app goes live last, so it never runs against a database that hasn't been migrated yet.

**Database (job 2):**
- `supabase db push` applies only migrations the staging database hasn't had yet.
- On a new project, that's the schema baseline, then the storage buckets and policies, then the cron jobs.

**Edge Functions (job 2):**
- Each function is deployed with its own `deno.json` and the `verify_jwt` setting from `supabase/config.toml`.
- A secret that is set in GitHub overwrites the value in Supabase.
- Optional secrets that aren't set in GitHub are skipped, so a value already in Supabase stays.

**Web app (job 3):**
- Cloudflare serves the files in `dist/` (configured in [`wrangler.jsonc`](wrangler.jsonc)).
- Unknown paths fall back to `index.html`, so client-side routes work on refresh.
- [`public/_headers`](public/_headers) caches the hashed files in `/assets/` for a year.

**What the pipeline does not do:**
- **Run `supabase/seed.sql`.** It's local-only.
- **Create Vault secrets.** They're set once by hand (step 2 below).
- **Lint.** ESLint crashes on this repo today: the installed `typescript-eslint` doesn't match ESLint 9.39. Add a lint step once that's fixed.

## One-time setup

### 1. Create the staging Supabase project

- **Plan:** in the same organization and region as production, on Postgres 17.
- **Database password:** keep the one you choose. It becomes `SUPABASE_DB_PASSWORD`.
- **Project ref:** note it from **Project Settings → General → Reference ID**.

### 2. Add the Vault secrets to staging

Run this once in the staging project's SQL editor.
- The `cron_secret` value must be **identical** to the `CRON_SECRET` GitHub secret below.
- Without these secrets, the cron jobs fail with "Vault secrets project_url and cron_secret are required…", and push notifications aren't sent.

```sql
select vault.create_secret('https://<staging-ref>.supabase.co', 'project_url');
select vault.create_secret('<long random value>', 'cron_secret');
```

More on these secrets: [supabase/README.md → Secrets per environment](supabase/README.md#secrets-per-environment).

### 3. Configure Auth on staging

In **Authentication → URL Configuration**:
- set **Site URL** to the staging web address;
- add that address with `/**` to **Redirect URLs**.

To have sign-up and password emails sent, set up SMTP (Resend) under **Authentication → Emails**.

### 4. Create the Cloudflare API token

1. In the Cloudflare dashboard, go to **My Profile → API Tokens → Create Token**.
2. Use the **Edit Cloudflare Workers** template.
3. Copy the **Account ID** from the account's **Workers & Pages** overview.

The first deploy creates the Worker `flowleed-staging`. It's served at `https://flowleed-staging.<your-subdomain>.workers.dev`. To use your own domain, see the comment in `wrangler.jsonc`.

### 5. Create the GitHub environment

1. In **Settings → Environments**, create an environment named **`staging`**.
2. Under **Deployment branches**, allow only `dev`.
3. Add the secrets and variables below to that environment.

## GitHub secrets and variables

All of these go on the **`staging`** environment.
- **Secrets** are encrypted and masked in logs.
- **Variables** are visible values that aren't sensitive.

### Secrets

| Name | Required | Used for | Where to get it |
|---|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Yes | Supabase CLI login | Supabase dashboard → **Account → Access Tokens** |
| `SUPABASE_DB_PASSWORD` | Yes | `supabase db push` | Chosen when the project was created; reset under **Project Settings → Database** |
| `CLOUDFLARE_API_TOKEN` | Yes | `wrangler deploy` | Step 4 |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | `wrangler deploy` | Step 4 |
| `CRON_SECRET` | Yes | Edge Function secret; the cron-called functions and `send-push` check it | A long random value, identical to the `cron_secret` Vault secret (step 2) |
| `TOKEN_SALT` | Yes | Edge Function secret; password-reset and email-verification tokens | A long random value |
| `GLOO_CLIENT_ID` | Yes | Edge Function secret; Gloo AI | Gloo AI developer portal |
| `GLOO_CLIENT_SECRET` | Yes | Edge Function secret; Gloo AI | Gloo AI developer portal |
| `LOVABLE_API_KEY` | For Content | Edge Function secret; embeddings and the story drafter | Lovable |
| `SUPADATA_API_KEY` | No | Edge Function secret; YouTube transcripts | Supadata |
| `RESEND_API_KEY` | No | Edge Function secret; email | Resend |
| `PCO_OAUTH_CLIENT_ID` | No | Edge Function secret; Planning Center connect | Planning Center developer apps |
| `PCO_OAUTH_CLIENT_SECRET` | No | Edge Function secret; Planning Center connect | Planning Center developer apps |
| `VAPID_PRIVATE_KEY` | No | Edge Function secret; push notifications | Your VAPID key pair |
| `TWILIO_ACCOUNT_SID` | No | Edge Function secret; texting and calling (paused) | Twilio console |
| `TWILIO_AUTH_TOKEN` | No | Edge Function secret; texting and calling (paused) | Twilio console |

### Variables

| Name | Required | Used for | Value |
|---|---|---|---|
| `SUPABASE_PROJECT_REF` | Yes | Which project the CLI deploys to | The staging Reference ID (step 1) |
| `VITE_SUPABASE_URL` | Yes | Built into the web app | `https://<staging-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Built into the web app | Staging **Project Settings → API Keys**, the publishable (or legacy anon) key |
| `SITE_URL` | Yes | Edge Function secret for links in emails; also the environment link in GitHub | The staging web address, for example `https://flowleed-staging.<your-subdomain>.workers.dev` |
| `VITE_VAPID_PUBLIC_KEY` | No | Built into the web app; push notifications | Your VAPID public key, the same value as `VAPID_PUBLIC_KEY`. Without it, push notifications can't be turned on. |
| `VAPID_PUBLIC_KEY` | No | Edge Function secret; push notifications | Your VAPID public key |
| `VAPID_SUBJECT` | No | Edge Function secret; push notifications | For example `mailto:support@flowleed.com` |

You don't set `SUPABASE_URL`, `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. Supabase gives them to every Edge Function automatically.
You can use `npx web-push generate-vapid-keys` to generate the VAPID keys

## Day to day

- **Deploy:** merge or push to `dev`.
- **Watch it:** open the run under **Actions**. When it finishes, the `staging` environment shows a link to the site.
- **Add a dependency:** CI installs strictly from `bun.lock`, which Lovable keeps up to date.
  - If you add a package locally with npm, also run `bun install` and commit `bun.lock`.
  - Otherwise the build fails at "Install dependencies".
- **Change the database:** add a migration (see [supabase/README.md → Making changes](supabase/README.md#making-changes)). The next deploy applies it.

## Rolling back

| What to roll back | How |
|---|---|
| **Web app** | Run `npx wrangler@4 rollback --env staging`, or pick an earlier version under **Workers & Pages → flowleed-staging → Deployments**. |
| **Database** | Migrations only move forward. Undo a change with a new migration that reverses it. |
| **Edge Functions** | Revert the commit and push to `dev`. The functions are redeployed from that code. |

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Build fails at "Check build variables" | `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` isn't set on the `staging` environment. |
| Build fails at "Install dependencies" | `bun.lock` doesn't match `package.json`. Run `bun install` and commit `bun.lock`. |
| `supabase db push` fails with "Remote migration versions not found in local migrations directory" | The project's migration history has versions that aren't in `supabase/migrations/`. This doesn't happen on a new staging project. For production, see the checklist in [supabase/README.md](supabase/README.md#before-merging-to-dev-and-turning-on-cicd). |
| Cron jobs fail in `cron.job_run_details` with "Vault secrets … are required" | Step 2 wasn't done. |
| Cron calls get a 401 | The `cron_secret` Vault value and the `CRON_SECRET` secret are different. |
| The site loads but the page is blank | The build ran without the `VITE_` variables. |
| Refreshing a page gives a 404 | `not_found_handling` is missing from `wrangler.jsonc`. |

## Adding production

Production needs the checklist in [supabase/README.md → Before merging to dev and turning on CI/CD](supabase/README.md#before-merging-to-dev-and-turning-on-cicd) done first, in particular:
- repair the migration history;
- create the Vault secrets;
- rotate the cron secret;
- compare `verify_jwt` with production.

Then:
1. Create a GitHub environment `production`. Allow only `main`, and add required reviewers so every deploy waits for approval.
2. Give it the same secrets and variables, with production values.
   - For `VAPID_PUBLIC_KEY`, `VITE_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, reuse production's existing VAPID pair (its `VAPID_PUBLIC_KEY` Supabase secret). A new pair would break every existing browser subscription.
3. Copy the workflow to `deploy-production.yml`:
   - trigger on `main`;
   - use `environment: production`;
   - deploy with `wrangler deploy` (no `--env`). That creates the Worker `flowleed`.
4. Move `app.flowleed.com` to the Worker, and update the Supabase Auth URLs and the `SITE_URL` variable.

# AGENTS.md

These rules are for every coding agent working in this repository, including Lovable. Follow them on every change. If a request conflicts with a rule, stop and ask the developer instead of working around it.

## How changes ship

- Lovable works in a separate repository (`FlowLeed-Lovable`). The developer merges its changes into the `lovable` branch here and cleans them up (`scripts/lovable-sync-check.ts` lists what each batch needs). Changes reach staging when a pull request is merged into `dev`.
- A GitHub Actions workflow then:
  1. applies the database migrations;
  2. deploys the Edge Functions;
  3. publishes the web app on Cloudflare.
- Nothing in this repository is deployed by Lovable. The workflow is the only way code from here reaches a database or a server.

## 1. Never put a key, secret or credential in code

This rule has no exceptions.

**What counts as a secret:**
- API keys;
- access and refresh tokens;
- OAuth client IDs and client secrets;
- passwords;
- the Supabase service-role key;
- the cron secret;
- webhook signing secrets;
- private keys, including the VAPID private key;
- database connection strings.

**Never write a secret into any of these:**
- source code;
- migrations or `seed.sql`;
- tests or fixtures;
- comments;
- README or other docs, including examples;
- log lines or error messages;
- commit messages;
- the chat.

This also applies to secrets that look like test values.

**Where secrets live instead:**

| Kind | Where it's stored | How code reads it |
|---|---|---|
| Edge Function secret | Supabase project secrets, set from GitHub by CI | `Deno.env.get("NAME")` |
| Database secret | Supabase Vault | Read by name in SQL at run time, e.g. `vault.decrypted_secrets where name = 'cron_secret'` |
| Local values | `supabase/functions/.env.local` and `.env.local` (both git-ignored) | Never committed. Never create or edit these files. |

**The browser is public:**
- Every `VITE_` variable is built into the JavaScript that ships to users, so a `VITE_` variable must never hold a secret.
- The only `VITE_` variables are `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_VAPID_PUBLIC_KEY`. All three are public by design.
- Never call an AI provider or any other third-party API from the browser with a key. Call an Edge Function, and let the function use the secret.

**No environment-specific addresses either:**
- Never hard-code a Supabase project URL or project ref.
- Never hard-code the app's own address (`*.lovable.app`, `app.flowleed.com`, `localhost`).
- Use `SITE_URL` or `SUPABASE_URL` in Edge Functions, `functionUrl()` in the app, and the `project_url` Vault secret in SQL.

**When a change needs a new secret:**
1. Read it with `Deno.env.get("NAME")`, and return a clear error if it's missing.
2. Add the name with an empty value (`NAME=`) to `supabase/functions/.env.example`.
3. Tell the developer the secret's name and what it's for. They add it to GitHub and the deploy workflow.

**If you find a secret already in the code:** don't copy it, move it or reuse it. Tell the developer where it is.

## 2. Files you must not change

| Path | Why |
|---|---|
| `.env`, `.env.*`, `supabase/functions/.env*` (except adding a name to `supabase/functions/.env.example`) | Local and per-environment values. Never committed. |
| `src/integrations/supabase/client.ts` | Reads its settings from env vars. Don't regenerate it or hard-code values. |
| `supabase/migrations/20260930000000_baseline.sql` and every existing migration | Migrations may already have run on staging. Change the database with a new migration. |
| `supabase/migrations_archive/**` | Historical record only. |
| `supabase/seed.sql` | Local-only values, maintained by the developer. |
| `supabase/config.toml` | You may only **add** a `[functions.<name>]` entry for a new function. |
| `.github/**`, `public/_headers` | Deployment, maintained by the developer. |
| `bun.lock` | Add packages the normal way and let `bun.lock` update itself. CI installs strictly from `bun.lock`. |

Never run SQL against a hosted database, deploy Edge Functions, set secrets or publish the site. Don't offer to run SQL from the chat, and don't ask to connect Supabase.

## 3. Web app patterns

**Supabase client.** Import it with `import { supabase } from "@/integrations/supabase/client"`.

**Calling Edge Functions** uses three layers. Follow `src/api/groupSignup.ts` and `src/hooks/useGroupSignup.tsx`:

1. **`src/api/<service>.ts`** is the only place that calls Edge Functions.
   - Use `invokeFunction<T>(name, options, { service, fallback, useServerMessage? })` from `src/api/supabaseFunctions.ts`. It turns every failure into a `ProviderError` (`src/errors/ProviderError.ts`) with a message that's safe to show users.
   - Set `useServerMessage: false` when the function's own error text isn't meant for users.
   - Use `functionUrl(name, params)` when the browser or a third party needs the address itself, such as an `<img src>` or a webhook URL.
2. **`src/hooks/use<Feature>.tsx`** wraps the API functions with TanStack Query: `useQuery` for reads and `useMutation` for writes.
3. **Pages and components** use the hooks.
   - Never `supabase.functions.invoke(...)` or `fetch(".../functions/v1/...")` in a page or component.
   - Never build a function URL by hand.

**Older code.** About 40 files still call functions directly. Don't rewrite them unless asked. When you change one of those calls, move it into the matching `src/api` file and hook.

**Shared types.** Request and response types used by both the app and a function live in `supabase/functions/_shared/models/<Name>.ts`.
- In the app, import them type-only: `import type { GroupDetails } from "@shared/models/GroupDetails"`.

**Types.** `no-explicit-any` is switched off only for older code. Give new code real types.

## 4. Edge Function patterns

**Layout.** Each function has `supabase/functions/<name>/index.ts` and its own `deno.json`.

**Server.**
- Use `Deno.serve(async (req) => { ... })`.
- Don't use `serve` from `std/http`, the `xhr` polyfill, `esm.sh` URLs, `deno.land` URLs or unpinned `npm:` imports.

**Imports.**
- Use bare specifiers, mapped in the function's own `deno.json`.
- List only what that function uses, including what its `_shared` files use. Supabase has no shared import map, so each function needs its own.
  ```json
  { "imports": { "@supabase/supabase-js": "npm:@supabase/supabase-js@2.117.2" } }
  ```
- Pinned versions:

  | Import | Version |
  |---|---|
  | `@supabase/supabase-js` | `npm:@supabase/supabase-js@2.117.2` |
  | `openai` | `npm:openai@7.25.0` (any function that imports `_shared/gloo.ts`) |
  | `resend` | `npm:resend@4.0.0` |
  | `react` | `npm:react@18.3.1` |
  | `@react-email/components` | `npm:@react-email/components@0.0.22` |

**CORS.** Use `corsHeaders` from `_shared/cors.ts` and answer `OPTIONS` requests.

**A new function** also needs a `[functions.<name>]` entry in `supabase/config.toml` with `verify_jwt`:
- `true` (the default) for anything a signed-in user calls;
- `false` only for:
  - public pages;
  - webhooks, which must verify the provider's signature instead;
  - functions called by cron.

**Functions called by cron** must reject every other caller, and need `verify_jwt = false`:
```ts
const unauthorized = rejectUnlessCron(req, corsHeaders); // from _shared/cron-auth.ts
if (unauthorized) return unauthorized;
```

**AI and data providers.** Each one has its own secret. Never send one provider's key to another provider.

| Provider | Used for | How to call it |
|---|---|---|
| **Gloo AI** | All AI: chat, reasoning and embeddings (Care Agent, morning briefing, Signal Agent, suggestions, Content search and answers, story drafter) | Always through the helpers in `_shared/gloo.ts`, which wrap the `openai` SDK: `glooChat`, `glooChatStream` (raw SSE stream), `glooToolCalls`, `glooErrorStatus` (for 429 and 402) and `glooEmbed`. Never call Gloo's URL or create an `OpenAI` client elsewhere. The only credential is `GLOO_API_KEY`. Don't add another AI provider, such as the Lovable AI Gateway. |
| **Embeddings** | Content search | `glooEmbed` uses `GLOO_EMBEDDING_MODEL` at `EMBEDDING_DIMENSIONS` (384), matching the `vector(384)` columns. Changing the model or the size means re-embedding all content, so ask first. |
| **Voice input** | Voice notes in the AI chat | The browser's speech recognition, through `src/hooks/useSpeechRecognition.tsx`. No server, no key. |
| **Supadata** | YouTube transcripts | Key `SUPADATA_API_KEY`, sent in the `x-api-key` header. |

**Logging.** Never log:
- secrets or tokens;
- `Authorization` headers;
- full request bodies that contain people's personal details.

## 5. Database patterns

**Every change is a new migration.**
- Name it `supabase/migrations/<YYYYMMDDHHMMSS>_<snake_case_name>.sql`, with a UTC timestamp later than the newest file.
- The same file runs unchanged locally, on staging and in production, so:
  - it must not contain URLs, keys or project refs;
  - it should be safe to run again where that's practical: `create … if not exists`, `create or replace`, `on conflict do nothing`.

**Security.**
- Every new table in `public` gets `alter table … enable row level security` and its policies in the same migration.
- `security definer` functions set `search_path = ''` and schema-qualify every name.

**Storage.** Buckets and `storage.objects` policies go in a migration, following `20261001140000_storage_buckets_and_policies.sql`.

**Scheduled jobs.** Always go through the helper, and never `net.http_post` with a URL or key:
```sql
select cron.schedule('<job-name>', '<cron expression>',
  $$select private.invoke_edge_function('<function-name>', '{}'::jsonb)$$);
```

**Vault.**
- Refer to Vault secrets by name only. Never call `vault.create_secret` with a value in a migration.
- A new Vault secret is set by the developer in each environment, so tell them its name.

**Generated types.** After a schema change, update the affected types in `src/integrations/supabase/types.ts` in the same generated format. The developer regenerates the whole file before merging.

## 6. Before you finish a change

- [ ] No key, secret, token, password, project URL or app address appears in the diff.
- [ ] Edge Function calls go through `src/api/<service>.ts` and a hook.
- [ ] A new function has its `deno.json`, uses `Deno.serve`, and has a `config.toml` entry.
- [ ] A function called by cron starts with `rejectUnlessCron`.
- [ ] Database changes are in a new migration, and new tables have RLS.
- [ ] Any new secret name is in `.env.example` (with no value), and you've told the developer.
- [ ] The app type-checks and builds.

## 7. Product design notes

Decisions recorded by Lovable while building features. Keep them when changing these areas.

- Care agent: `care-agent-run` edge function (cron, bounded batches, per-org lease in `care_agent_state`) writes per-leader rows to `care_recommendations`; the main AI conversation renders and acts on those rows directly under recipient-only RLS. Why: deterministic orchestration with AI used only for wording, without a separate briefing destination.
- When demo data is cleared and an org has zero flows, a trigger on `organizations.demo_cleared_at` calls `create_default_pipelines`. Why: churches must never be left with an empty Flows list.
- create_form tool hands off to Form Builder specialist (_shared/formAgent.ts): separate focused AI call designs the blueprint, main agent only routes. Why: specialists stay small and controllable.
- Form Builder uses a persistent field palette on larger screens and a bottom field picker on phones. Why: the editing canvas must remain full-width and touch-friendly on small screens.
- Flow form-submission details are loaded once at the Flow level and shared by card and table views. Why: both views must show identical answers without per-person request waterfalls.
- Desktop navigation is a label-free 56px icon rail (standalone AI button on top, then HUB, Flows, Marketing, Settings) with tooltips and a collapsible section drawer that updates `--sidebar-width`; phones keep the grouped sheet. Why: wide boards get space while large churches keep quick navigation.
- The FlowLeed AI icon is the purple rounded tile with a white sparkle mark in src/components/content/AiBrandIcon.tsx — use it wherever the AI appears (nav rail, mobile tab bar, dashboard hero, content pages). The outline sparkle (AiSparkleIcon.tsx) was tried and rejected by the user; keep the file but do not use it. All other icons stay thin-outline Lucide (strokeWidth ~1.7-2, h-5 w-5, muted-foreground). Why: the user confirmed the purple sparkle tile as the brand AI mark.

## More detail

- [README.md](README.md): what the app does, environment variables, running it locally.
- [supabase/README.md](supabase/README.md): migrations, cron jobs, Vault and secrets per environment.
- [DEPLOYMENT.md](DEPLOYMENT.md): the staging pipeline.

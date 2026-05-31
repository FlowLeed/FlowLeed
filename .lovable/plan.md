# Planning Center: PAT → OAuth + Per-User Connections

Ships safely (PAT keeps working), adds OAuth at the org level for sync, layers per-user PCO connections for permission-aware visibility, and binds both to a specific PCO organization so the wrong account cannot be linked.

## Phase 0 — PCO app + secrets (manual)

- One OAuth app in PCO dev account.
- Scopes: `people services check_ins giving groups`.
- Register redirect URIs:
  - `https://app.flowleed.com/pco/callback`
  - `https://flow-follow-up-friend.lovable.app/pco/callback`
  - `https://id-preview--4ab24618-34ac-47c5-b901-113c1bc869f2.lovable.app/pco/callback`
- Lovable Cloud secrets: `PCO_OAUTH_CLIENT_ID`, `PCO_OAUTH_CLIENT_SECRET`, `PCO_OAUTH_REDIRECT_URI`.

## Phase 1 — Database foundation (migration only, PAT untouched)

**Extend `integrations`** (keep PAT columns during transition):
- `auth_type text not null default 'pat'` (`'pat' | 'oauth'`)
- `oauth_access_token text`, `oauth_refresh_token text`, `oauth_token_expires_at timestamptz`
- `oauth_scopes text`, `oauth_connected_by_user_id uuid`
- `provider_account_id text` — PCO organization id
- `provider_account_name text` — PCO org display name
- `status` allow `'reauth_required'`

**New `pco_oauth_states`** (CSRF): `state pk, organization_id, user_id, purpose ('org'|'user'), created_at, expires_at (5 min), consumed_at`.

**New `user_pco_connections`**: `user_id, organization_id, pc_person_id, email, oauth_access_token, oauth_refresh_token, oauth_token_expires_at, oauth_scopes, status, provider_account_id, permissions_json, permissions_refreshed_at`. Unique `(user_id, organization_id)`.

**RLS**:
- Token columns on `integrations`: service-role only. Expose non-secret metadata via `integrations_public` view.
- `user_pco_connections`: user reads own row (non-token fields); service role manages tokens.
- `pco_oauth_states`: service role only.

## Phase 2 — Shared auth helper + refresh

`supabase/functions/_shared/pco-auth.ts`:
- `getPcoAuthHeader(supabase, integrationId)` — Bearer for oauth, Basic for legacy PAT.
- `getUserPcoAuthHeader(supabase, userId, orgId)`.
- `refreshOrgToken` / `refreshUserToken` — `SELECT … FOR UPDATE` lock, re-check expiry inside the lock, atomic write of new access + rotated refresh, flip to `reauth_required` on `invalid_grant`.
- `withPcoAuth(integrationId, fn)` retries once on 401.

Refactor all ~11 PCO edge functions to use the helper. No behavior change for PAT orgs.

## Phase 3 — Org-level OAuth flow

**Edge functions**:
- `pco-oauth-start` (admin only) — creates `pco_oauth_states` row (`purpose='org'`), returns PCO authorize URL.
- `pco-oauth-callback`:
  1. Validate state (single-use, unexpired, matches user/org).
  2. Exchange code → tokens.
  3. Fetch PCO org identity (`/people/v2` org relationship or `/people/v2/organization`) to capture `provider_account_id` + `provider_account_name`.
  4. **Account-mismatch guard**: if integration already has `provider_account_id` and the new one differs → abort: *"This Planning Center account (X) does not match the previously connected account (Y). Disconnect first if intentional."*
  5. Upsert tokens + scopes + provider fields, set `auth_type='oauth'`, `status='active'`, mark state consumed. Single transaction.

**Frontend**:
- `/pco/callback` route → calls `pco-oauth-callback`, redirects to `/integrations` with toast.
- `IntegrationsPage.tsx`: "Connect Planning Center" CTA; status card shows `Connected to: {provider_account_name}`, scopes, last sync, Reconnect / Disconnect. Inline mismatch error with disconnect guidance.
- Legacy PAT form hidden behind "Use legacy token" disclosure until cutover.

## Phase 4 — Per-user PCO connections (permission layer)

**Rule**: Org token = sync data. User token = permission check. FlowLeed role = product permission. Visibility = most restrictive.

**Backend**:
- Reuse `pco-oauth-start` with `purpose='user'` (no admin check).
- User callback path:
  1. Validate state, exchange code.
  2. `/people/v2/me` → capture `pc_person_id`, email, PCO org id.
  3. **Org-binding guard**: load FlowLeed org's `integrations.provider_account_id`. Absent → reject ("Your organization must connect Planning Center first."). Mismatch → reject ("This Planning Center account does not match this FlowLeed organization.").
  4. Upsert `user_pco_connections`.
- `getUserPcoPermissions(userId, orgId)` — cached snapshot of campus access + app permissions (People, Check-Ins, Services, Groups, Giving); TTL ~1h; manual refresh.
- SECURITY DEFINER fn `can_user_see_contact(_user_id, _contact_id)` combining existing RLS + connection status + cached permission flags + campus scope.

**Frontend**:
- "Connect your Planning Center account" section on `/profile` (+ onboarding step for non-admins).
- "Connect required" empty state with CTA on contact/flow views when no active connection.
- Inline mismatch error on wrong account.
- Filter contact/flow/check-in lists through `can_user_see_contact` + cached permissions.

## Phase 5 — Resilience & ops

- 401 → refresh → retry; `invalid_grant` → `reauth_required` + email org owner / notify user.
- Daily `pg_cron` job pre-refreshes any token expiring in <24 h.
- Long backfills re-check expiry per page.
- Structured logs on every refresh (success/fail, latency, actor).
- Banner UX for `reauth_required` on Integrations + Profile.

## Phase 6 — Migrate existing orgs

- Ship Phases 1–5 with `auth_type='pat'` default; no behavior change.
- Banner: *"Action required: reconnect Planning Center via OAuth before <date>."*
- Track per-org in `organizations.onboarding_progress.pco_oauth_migrated`.
- Internal org first → progressive rollout → all orgs.
- After 2–4 week cutover: null legacy credentials for migrated rows, remove PAT form, drop PAT columns in follow-up migration (post-backup).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Refresh-token race | `FOR UPDATE` lock, re-check inside lock, atomic UPDATE |
| Lost refresh token | Wrap exchange + write in transaction; alert on `invalid_grant` |
| Tokens in plain text | RLS + service-role only; follow-up: pgsodium/Vault |
| CSRF on handshake | `pco_oauth_states` with user_id, purpose, short TTL, single-use |
| Wrong PCO org at org level | Capture `provider_account_id`; reject reconnects that change it without explicit disconnect |
| User connects personal/other PCO account | Hard guard: user's `provider_account_id` must equal org integration's; inline error |
| Scope creep needing re-consent | Request full set on day one |
| Missed call sites using Basic auth | Centralize through helper in Phase 2 before any flip |
| Redirect URI mismatch across envs | All three domains registered; env-specific secret |
| User-revoked install | Detect `invalid_grant`, flip status, notify |
| Long backfills outlive token | Helper re-checks expiry per page |
| Per-user permission cache stale | TTL + on-demand + manual refresh button |

## File map (estimate)

- **New edge functions**: `pco-oauth-start`, `pco-oauth-callback` (handles org + user via `purpose`), `pco-token-refresh-cron`.
- **New shared module**: `supabase/functions/_shared/pco-auth.ts`.
- **New frontend**: `/pco/callback` page; user-PCO section in `ProfilePage.tsx`; connect/reconnect/disconnect UI in `IntegrationsPage.tsx`.
- **New SQL**: `pco_oauth_states`, `user_pco_connections`; extra columns on `integrations`; `can_user_see_contact`; daily cron.
- **Modified**: ~11 PCO edge functions; contact/flow queries to respect `can_user_see_contact`.
- **Untouched**: contact/flow/check-in/group data models.

## Rollout

- Phases 0–2 ship invisibly (PAT remains canonical).
- Phase 3 opens org OAuth — internal test first, then opt-in.
- Phase 4 turns on per-user connections (recommended → required for non-admins).
- Phase 5 hardens refresh + alerting.
- Phase 6 deprecates and removes PAT.

---

**Suggested first commit**: Phase 1 migration + Phase 2 helper (no user-visible change), so we have the safety net in place before any OAuth UI ships.

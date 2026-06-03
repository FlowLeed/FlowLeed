## Goal
Show each user only the PCO lists their **own** Planning Center account can see when creating/editing list mappings — no per-user caching.

## Changes

### 1. Edge function: `supabase/functions/planning-center-lists/index.ts`
- In the `fetchLists` action, replace `getPcoAuthHeader(supabase, integrationId)` with `getUserPcoAuthHeader(supabase, userId, organizationId)`.
  - Derive `userId` from the JWT (function already runs with `verify_jwt = false`, so read `Authorization` header and call `supabase.auth.getUser(token)`).
  - Look up `organization_id` from the `integrations` row using `integrationId`.
- Catch `USER_PCO_NOT_CONNECTED` and `USER_PCO_REAUTH_REQUIRED` and return them as structured JSON errors (HTTP 200 with `{ error: 'USER_PCO_NOT_CONNECTED' }` so the client can branch).
- Leave all other actions (org-level sync, member fetching, etc.) untouched — they continue using `getPcoAuthHeader`.

### 2. Frontend: `src/components/integrations/PlanningCenterListBrowser.tsx`
- Replace the `useQuery` against `integration_list_metadata` with a `useQuery` that invokes `planning-center-lists` (`action: 'fetchLists'`) and returns the live PCO response mapped to the existing `PlanningCenterList` shape.
- Remove the separate "Refresh" mutation — the same query is refetched via `refetch()`; keep the Refresh button wired to `refetch()`.
- Handle two new error states with inline prompts:
  - `USER_PCO_NOT_CONNECTED` → "Connect your Planning Center account to see your lists" + link/button to profile PCO connect (reuse pattern from `PcoPersonalConnectPrompt`).
  - `USER_PCO_REAUTH_REQUIRED` → "Your Planning Center session expired. Reconnect to continue." + same connect action.
- Add a small loading spinner state for the live fetch (already present).

### 3. No DB migration
- `integration_list_metadata` table stays as-is (still used elsewhere for org-level metadata / sync mappings). We simply stop reading from it in the browser.

## Out of scope
- Sharing lists between users.
- Changing how mappings sync (auto-sync keeps using the org token — mappings are org-shared resources).
- Any change to `pipeline_contacts` or moment mappings.

## Technical notes
- `planning-center-lists` currently has `verify_jwt = false` in `config.toml`. We'll read the user JWT manually inside the function via `supabase.auth.getUser(authHeader)` so we can identify the calling user without changing the function's public contract.
- The existing `getUserPcoAuthHeader` helper in `_shared/pco-auth.ts` already handles refresh + reauth flagging, so no auth plumbing changes are needed.

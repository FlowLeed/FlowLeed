# Phase 4 — Per-user PCO permission enforcement

The `user_pco_connections` table and `PcoPersonalConnection` UI already exist, but nothing yet uses the personal PCO token to limit what each user can see. This phase wires it into reads.

## What we're building

1. A cached snapshot of each user's PCO-visible person IDs (refreshed periodically).
2. A `can_user_see_contact(user_id, contact_id)` SECURITY DEFINER helper.
3. Updated RLS on `contacts` and `pipeline_contacts` so non-admin users only see contacts their personal PCO account can see.
4. UI affordance on the profile + integrations page so users understand what "connect personal account" actually unlocks.

## Scope (out)

- Phase 6 (PAT removal, org migration banner) — separate follow-up.
- Org-level admins / `service_role` paths keep full visibility.
- Users without a personal PCO connection: configurable — default to **org-wide visibility** (today's behavior) so we don't accidentally hide everything. Opt-in strict mode comes later.

## Steps

### 1. Schema (migration)

- New table `public.user_pco_visible_people`
  - `user_id uuid`, `org_id uuid`, `pc_person_id text`, `synced_at timestamptz`
  - PK `(user_id, pc_person_id)`, index on `(user_id)`.
  - GRANT select to `authenticated`, all to `service_role`. RLS: user can read own rows only.
- New column `user_pco_connections.permissions_synced_at timestamptz`.
- New column `organizations.pco_enforce_user_permissions boolean default false` (kill-switch / opt-in per org).

### 2. SECURITY DEFINER helpers

- `public.user_has_pco_connection(_user uuid) returns boolean`
- `public.can_user_see_contact(_user uuid, _contact uuid) returns boolean`
  - Returns true if:
    - org has `pco_enforce_user_permissions = false`, OR
    - user is org admin / system admin, OR
    - user has no active personal PCO connection (fallback to org visibility), OR
    - contact's `pc_person_id` exists in `user_pco_visible_people` for that user.

### 3. RLS updates

- Replace the existing `SELECT` policy on `public.contacts` and `public.pipeline_contacts` so the org-membership check is `AND can_user_see_contact(auth.uid(), contacts.id)`.
- Leave INSERT/UPDATE/DELETE policies alone (already team-scoped).

### 4. Permission sync edge function

- New `supabase/functions/pco-sync-user-permissions/index.ts`
  - Auth: JWT-verified caller, looks up own `user_pco_connections` row.
  - Uses `getUserPcoAuthHeader` to page `/people/v2/people?per_page=100` with the user's token, collecting `id`s.
  - Upserts into `user_pco_visible_people` (delete rows not seen in this run for that user), stamps `permissions_synced_at`.
  - Respects existing PCO rate-limit helper (350ms delay + backoff).
- Schedule via pg_cron daily at 04:00 UTC (`pco-user-permissions-daily`) calling the function for every user with an active connection.
- Also call it inline at the end of `pco-oauth-callback` when the callback is for a user token, so first sync happens immediately on connect.

### 5. Frontend

- `PcoPersonalConnection.tsx`: after a successful connect, show "Syncing visible people…" state, then "Last synced {relative time} · {N} people visible". Add a "Resync now" button that invokes `pco-sync-user-permissions`.
- `IntegrationsPage.tsx`: under the OAuth section, add a small toggle (admin-only) for `pco_enforce_user_permissions` with copy explaining that turning it on restricts each user to contacts their personal PCO account can see.
- `ProfilePage.tsx`: when enforcement is ON but the user has no personal connection, surface a soft warning above the PCO card explaining they'll see only contacts they own / are assigned to — recommend connecting.

## Technical details

```text
contacts SELECT policy
  ──► org membership check
  ──► AND can_user_see_contact(auth.uid(), contacts.id)
        ├── org.pco_enforce_user_permissions = false → true
        ├── has_role(uid, 'admin')                   → true
        ├── no user_pco_connections row              → true (fallback)
        └── EXISTS user_pco_visible_people row       → true
```

Sync function pseudocode:
```ts
const { header } = await getUserPcoAuthHeader(supabase, userId);
const seen = new Set<string>();
let next = `${PCO_BASE}/people/v2/people?per_page=100&fields[Person]=id`;
while (next) {
  const res = await fetch(next, { headers: { Authorization: header } });
  if (res.status === 401) { await markReauthRequired(); break; }
  const json = await res.json();
  for (const p of json.data) seen.add(p.id);
  next = json.links?.next ?? null;
  await sleep(350);
}
await supabase.rpc('replace_user_pco_visible_people', { _user: userId, _ids: [...seen] });
```

A small RPC (`replace_user_pco_visible_people`) does the transactional delete-then-insert so we don't leave stale rows.

## Validation

- Manual: as a user with a limited PCO account, connect → run sync → confirm `contacts` query in the app returns only the expected subset.
- SQL: `SELECT can_user_see_contact('<uid>', '<contact_id>')` for a few sample contacts.
- Verify org admin and system admin still see everything.
- Verify users without a personal connection still see org-wide contacts (kill-switch behavior).
- Check cron ran: `SELECT * FROM cron.job WHERE jobname='pco-user-permissions-daily'`.

## Risk / rollback

- Kill switch is `organizations.pco_enforce_user_permissions = false` (default). If anything goes wrong in prod, flipping that column instantly restores org-wide visibility without redeploying.
- All RLS changes are additive (extra AND clause); reverting the policy restores prior behavior.

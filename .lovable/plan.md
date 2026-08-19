# Planning Center connect: let PCO own the account chooser

Yes — this flow is possible, and most of the pieces already exist. The proposal matches how Planning Center's OAuth/OIDC works, so we let PCO show its own "Choose an organization" screen instead of building our own account picker.

## What's true today (verified in the code)

- The authorize URL is built in `pco-oauth-start` with `scope = "people services check_ins giving groups"` — **`openid` is not requested**, so we never receive an `id_token`.
- `prompt=select_account` is already sent, but only when the UI passes `forceAccountSelect`. There is no `prompt=login` option and no `nonce`.
- The callback already identifies the connected church by calling `/people/v2/me?include=organization` and stores `provider_account_id` / `provider_account_name` on the `integrations` row, with a mismatch guard against reconnecting a different church.
- There is **no confirmation step**: once the code is exchanged, the connection is saved immediately with no "this is the church we found — continue?" screen.
- An earlier report of a PCO 404 when `prompt=select_account` was present is unconfirmed; step 1 includes verifying that against a real authorize request before we rely on it.

## What we'll change

**1. Request OIDC and always offer account selection**
- Add `openid` to the requested scopes and generate a `nonce` stored alongside the OAuth state row.
- Always send `prompt=select_account` for a fresh connect; support `prompt=login` for "use different Planning Center credentials".
- Verify against a live authorize request that PCO accepts `openid` + `prompt` and shows the chooser (this is the one unknown; if PCO rejects a value we fall back to the parameter set it accepts).

**2. Read the selected organization from the `id_token`**
- Parse the `id_token` returned by the token exchange, check the `nonce`, and take `organization_id` / `organization_name` / `email` from it.
- Keep the existing `/me?include=organization` call as a fallback so nothing breaks if the token is absent.

**3. Add a confirmation step before any sync**
- The callback stores the connection as **pending confirmation** instead of active: it returns the church name, org id, and the connecting user's account.
- The Integrations page shows a confirm card: "We found THE PROMISE CENTER (ID 123456), connecting as <name/email>, we'll sync People / Households / Workflows / Campuses" with **Connect this church** and **Choose another account** (which restarts the handshake with `prompt=select_account`).
- No sync starts until the user confirms.

**4. Keep the data model ready for multiple PCO connections**
- The existing `integrations` row already carries `provider_account_id`, `provider_account_name`, `oauth_connected_by_user_id`, and `status`, which is the shape the proposal describes. We keep one active connection per FlowLeed org in the UI, but stop assuming uniqueness in the code paths that read it, so adding a second church later is a UI change rather than a schema migration.

## Technical notes

- Files: `supabase/functions/pco-oauth-start/index.ts` (scopes, nonce, prompt), `supabase/functions/pco-oauth-callback/index.ts` (id_token parse + nonce check + pending status), `supabase/functions/_shared/pco-auth.ts` (`PCO_OAUTH_SCOPES`), `src/pages/IntegrationsPage.tsx` (confirm card, "Choose another account", `prompt=login` option).
- A migration adds a `nonce` column to `pco_oauth_states` and allows a `pending_confirmation` status on the connection.
- `id_token` is verified for `nonce` + `aud` + expiry; we treat its claims as the source of truth for which church was selected.
- Existing active connections are untouched — they stay active and are not forced through the new confirmation step.

## Out of scope

- Querying Planning Center for "all orgs this email administers" — that stays inside PCO by design.
- Actually exposing multiple simultaneous PCO churches per FlowLeed org in the UI.

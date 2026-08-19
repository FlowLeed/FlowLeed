# Fix Planning Center connect after the multi-account change

## What's actually broken

The multi-account change added a hidden pop-up step before redirecting to Planning Center. Two things go wrong:

1. The pop-up opens `https://login.planningcenteronline.com/logout`, which **no longer exists** — verified: it returns 404, which is exactly the "Air 404 is lost in space" screen in your screenshot. The working URL is `https://accounts.planningcenteronline.com/logout` (it 302-redirects internally).
2. Safari blocks the pop-up (your "Pop-up Window Blocked" screenshot). The code then waits 2.5 seconds, and if the browser also blocks the follow-up top-level redirect out of the preview frame, the button just keeps spinning with no error — which is the stuck "Connect Planning Center" spinner.

The `prompt=select_account` parameter itself is fine and does not break the authorize URL.

## The fix

- Drop the silent logout pop-up entirely. No pop-up means nothing to block.
- Keep `prompt=select_account` on the authorize URL for the "Choose a different account" path.
- Replace the hidden pop-up with an explicit, user-visible two-step option in the Planning Center card: a "Sign out of Planning Center first" link that opens the correct `accounts.planningcenteronline.com/logout` URL in a new tab, plus short copy telling the user to come back and click Connect. Users who administer several PCO orgs get a reliable way to switch accounts; everyone else is unaffected.
- Make the redirect failure visible: if the top-level navigation is blocked, stop the spinner, show a toast, and render a plain "Continue to Planning Center" link the user can click directly (a real link always works where scripted navigation is blocked).
- Always clear the loading state on any failure path so the button can never stay stuck.

## Technical notes

- `src/pages/IntegrationsPage.tsx` — `handleConnectPcoOAuth`: remove the `window.open(...logout)` + `setTimeout(2500)` block; after getting `authorizeUrl`, attempt the top-level redirect and on failure store the URL in state, reset `oauthLoading`, and surface a fallback anchor. Update the "Choose a different account" affordance to the logout-link + Connect pattern.
- `supabase/functions/pco-oauth-start/index.ts` — unchanged behaviour; keeps `prompt=select_account` when `forceAccountSelect` is true. No redeploy needed unless we touch it.
- Same pop-up-free redirect pattern is used by `src/pages/audit/AuditConnectPage.tsx`; it has no logout pop-up, so it stays as is.

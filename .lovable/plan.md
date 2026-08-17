# Make Planning Center connect predictable for multi-org admins

## What I verified

- `molodist+7@gmail.com` (Pastor Mike) is the **owner** of **The Connect Church** (`tpc`), so this account is set up correctly and the Connect button is genuinely enabled — nothing is broken about the membership this time.
- The connect button is only disabled when the signed-in user has no `organization_members` row (the earlier `alexandmedia@gmail.com` case).
- `pco-oauth-start` already supports `forceAccountSelect`, which adds `prompt=select_account` to the Planning Center authorize URL. Today it is only used by the small secondary link.

## The remaining real problem

Planning Center's authorize page silently reuses whatever PCO session the browser already has. So an admin of several PCO organizations clicks "Connect Planning Center" and gets bound to the wrong PCO org without ever seeing a chooser — and the current UI buries the escape hatch in a long underlined sentence.

## What to change (UI + connect flow only)

1. **Always offer the account choice up front.** The primary "Connect Planning Center" button asks PCO for its account chooser by default (`forceAccountSelect: true`), so the person confirms which Planning Center account/org they are linking instead of being auto-bound.
2. **Rewrite the card copy** to name the destination: state that the connection links this Planning Center account to *The Connect Church* (the current org name), and that they'll be asked to choose an account on Planning Center's side.
3. **Replace the long underlined link** with a compact secondary action ("Use a different Planning Center account") that keeps the existing popup-logout + chooser behavior for people already signed into the wrong PCO account.
4. **Explain the disabled state** instead of a dead grey button: when the user has no organization, show a short inline note that they need to finish org setup first, with a link to onboarding.
5. **After connecting**, keep and make prominent the "Connected to: <PCO org name>" confirmation line so a mis-link is obvious immediately.

## Technical notes

- `src/pages/IntegrationsPage.tsx`: default `handleConnectPcoOAuth(true)` for the primary button, restructure the OAuth block copy/buttons, add the no-org inline note.
- `supabase/functions/pco-oauth-start/index.ts`: no change needed; it already honors `forceAccountSelect`.
- No database or RLS changes.

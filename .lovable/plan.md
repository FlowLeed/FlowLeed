## What that link is

`https://email.auth.lovable.cloud/c/...` is the **default Lovable/Supabase auth email** — the built-in confirmation email that ships out of the box. It has no branding and doesn't use flowleed.com because it isn't going through our custom flow at all.

Right now the project sends **two emails** on signup:
1. Supabase's default confirmation (the `email.auth.lovable.cloud` link you pasted) — unbranded.
2. Our custom `send-signup-confirmation` Resend email — branded, points at flowleed.com.

## Goal

One branded auth email per event, sent from a flowleed.com sender, for signup confirmation, password reset, magic link, invite, email change, and reauthentication.

## Approach: use Lovable's managed auth email templates

Lovable has a managed auth-email pipeline (`auth-email-hook` + React Email templates) that intercepts Supabase's built-in auth emails and replaces them with branded ones sent from our own domain. This is the correct long-term fix — no double emails, all six auth events covered, links point at our domain.

### Steps

1. **Check domain status** — call `email_domain--list_email_domains` to confirm a flowleed.com sender is configured. If not, surface the email setup dialog so the user can add/verify it.
2. **Scaffold auth templates** — run `scaffold_auth_email_templates`. This creates:
   - `supabase/functions/auth-email-hook/` (the hook Supabase calls instead of sending default emails)
   - `supabase/functions/_shared/email-templates/*.tsx` — signup, recovery, magic-link, invite, email-change, reauthentication
3. **Apply Flowleed branding** to each template — primary color, foreground/muted colors, radius, font stack pulled from `src/index.css`; logo from `public/` if present. Match the app's tone/copy.
4. **Deploy** `auth-email-hook`.
5. **Retire the custom Resend auth emails** to stop the double-send:
   - Remove the `supabase.functions.invoke('send-signup-confirmation', ...)` call from `useAuth.signUp`.
   - Remove the `supabase.functions.invoke('send-password-reset', ...)` call from `useAuth.resetPassword` and switch it to `supabase.auth.resetPasswordForEmail(email, { redirectTo: ... })`.
   - Update `useAuth.changeEmail` to rely on Supabase's built-in email-change (drop the custom `change-email` invocation) OR keep it if we still need the 24h token flow — flag for confirmation.
   - `AuthVerifyPage` / `VerifyEmailPage` / `reset-password` edge function become dead code once we're on the managed flow; leave them in place for now and clean up in a follow-up so any in-flight tokens still work.
6. **Verify** — trigger a signup and a password reset, confirm only one email arrives, links are on flowleed.com, and clicking them completes the flow.

### Notes / open questions

- The managed flow uses Supabase's built-in recovery links (`type=recovery` hash), not our `auth_verification_tokens` table. That means the previous scalability fix (storing `user_id` on the token) becomes moot — Supabase handles the mapping. We can leave that migration as-is or drop it; not blocking.
- The user should tell me if they want to keep the custom-branded change-email flow (24h token + confirmation on the new address) or move that to Supabase's built-in flow too.

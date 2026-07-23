# Fix John's signup + harden email flow

## What we now know

- Supabase "Confirm email" is off (verified: recent `auth.users` rows have `confirmation_sent_at = null` and are auto-confirmed at signup).
- John Duarte has **no row in `auth.users`** — his account doesn't exist right now. Whatever `auth.lovable.cloud` link he got is dead regardless.
- All app code paths (`send-signup-confirmation`, `send-password-reset`, invitations) route through Resend from `noreply@flowleed.com`. No code calls `supabase.auth.resetPasswordForEmail` or admin `generateLink` for regular signup.
- So the leaked `auth.lovable.cloud` email came from a prior state when Confirm email was ON, not from current code.

## Step 1 — Unblock John (no code)

Ask John to sign up again at `https://app.flowleed.com/auth`. He'll get the branded Flowleed email from Resend this time. His old link is expired and points to a user that no longer exists — nothing to salvage.

## Step 2 — Add a safeguard so this can't regress

Even with the toggle off today, someone could flip Supabase's "Confirm email" back on later and we'd start double-emailing again. Add a small resilience layer:

1. **Track our own verification state.** Add `profiles.email_verified_at timestamptz` (nullable). `verify-email-token` sets it. `send-signup-confirmation` is the only thing that sends the link.
2. **Gate login on our verification, not Supabase's.** In `useAuth.signIn`, after a successful `signInWithPassword`, check `profiles.email_verified_at`. If null, sign the user out and show "Please verify your email — resend?". This decouples us from Supabase's confirm setting entirely.
3. **Resend button** on the auth page that calls `send-signup-confirmation` again for the entered email (rate-limited to once per 60s client-side).

## Step 3 — Small cleanup

- Remove the now-unused `emailRedirectTo` / confirmation expectations from `useAuth.signUp` comments so the intent is clear: Supabase auto-confirms, we gate on our own flag.
- Add a one-line note at the top of `send-signup-confirmation/index.ts` documenting that this is the **only** signup email path.

## Technical details

- Migration: `ALTER TABLE public.profiles ADD COLUMN email_verified_at timestamptz;` + backfill existing profiles to `now()` (all current users are already using the app, so treating them as verified is safe).
- `verify-email-token` edge function: on success, `UPDATE profiles SET email_verified_at = now() WHERE user_id = $1`.
- `useAuth.signIn`: after `signInWithPassword` succeeds, `SELECT email_verified_at FROM profiles WHERE user_id = auth.uid()`. If null → `supabase.auth.signOut()` + return `{ error: { message: 'Please verify your email. Check your inbox or click resend.' } }`.
- Auth page: on that specific error, show a "Resend verification email" button that invokes `send-signup-confirmation`.

## Out of scope

- No changes to password reset flow (already Resend-only, working).
- No changes to invitations (already Resend-only).
- Not touching Supabase auth provider settings from code (can't, and don't need to).

# Simplified signup: email + password, instant login

## Goal
Make account creation a single step: enter email and password, get signed in immediately, land on the dashboard. Add Google sign-in and legal links.

## What changes for users

**Sign up form** becomes just:
- "Continue with Google" button
- Email
- Password
- Create account button
- "By continuing, you agree to our Terms of Use and Privacy Policy" (both link to http://flowleed.com/legal, new tab)
- "Already have an account? Sign in"

Removed from signup: full name, church/organization name, the slug availability checker, and the "check your email to verify" step.

**After signup:** the user is signed in right away and redirected to the dashboard (Flowleed AI). Their organization is auto-created from their email address; they can rename it later in Organization Settings.

**Sign in** keeps email + password + Remember me + forgot password, and gains the same Google button.

Apple sign-in is skipped for now (needs a paid Apple Developer account); the layout leaves room to add it later.

## Technical notes

1. `src/pages/AuthPage.tsx`
   - Strip `fullName`, `organizationName`, slug-check state/effects and their inputs from the signup branch.
   - Add a Google OAuth button (both modes) calling `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } })`.
   - Add the legal disclaimer line with links to `http://flowleed.com/legal`.
   - On successful signup, navigate to `/` (dashboard).

2. `src/hooks/useAuth.tsx`
   - `signUp(email, password)`: drop the `full_name` / `organization_name` metadata and the `send-signup-confirmation` invocation. Session comes back immediately once auto-confirm is on.
   - `signIn`: remove the `profiles.email_verified_at` gate that blocks unverified users (no longer meaningful once emails aren't required).

3. Auth config
   - Enable auto-confirm email so `signUp` returns a live session and no confirmation mail is sent.
   - The existing `handle_new_user` DB trigger already falls back to an email-derived organization name and slug, so no migration is needed.

4. Left in place, unused by the new flow: `send-signup-confirmation`, `verify-email-token`, `VerifyEmailPage`. Password reset emails keep working unchanged.

## Follow-up you'll need to do
Add Google OAuth client ID + secret in the Supabase dashboard (Authentication → Providers → Google), with the Supabase callback URL registered in Google Cloud. The button is inert until that's configured.

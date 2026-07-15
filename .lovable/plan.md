## Goal

Let form editors preview a draft form (before it's published) while keeping the public link "Form not found" for everyone else.

## How it works

1. In the builder, add a **Preview** button next to the existing "Copy link" / "Open" actions.
2. The button opens the same public URL `/:orgSlug/f/:formSlug` but appends a short-lived signed token, e.g. `?preview=<token>`.
3. The public form page passes that token through to `public-form-get` / `public-form-submit`.
4. The `public-form-get` edge function:
   - If `preview` token is present → verify it (signed with `SUPABASE_JWT_SECRET`, contains `form_id` + `user_id`, checks that the user is a member of the form's organization) and return the form **regardless** of `is_published`.
   - Otherwise → keep today's behavior (only return forms where `is_published = true`).
5. `public-form-submit` gets the same treatment so the editor can end-to-end test the flow. Submissions made in preview mode are flagged `is_preview = true` (new column on `form_submissions`) and are excluded from the regular submissions list by default, with a "Show preview submissions" toggle.
6. A visible **"Preview mode – not published"** banner is shown at the top of the form when the token is used, so testers know it's not the live version.

## UI changes

- `FormBuilderPage.tsx`
  - Add "Preview" button (opens preview URL in a new tab).
  - When the form is unpublished, show the banner "Not published yet — only you can preview this link."
- `PublicFormPage.tsx`
  - Read `preview` query param, pass it to both edge functions.
  - Render the preview banner when the response indicates preview mode.
- `FormSubmissionsPage.tsx`
  - Filter out `is_preview = true` by default with a toggle to include them.

## Backend changes

- Migration: add `is_preview boolean not null default false` to `form_submissions`.
- Edge function `public-form-get`:
  - Accept `preview` token, verify JWT, look up caller's org membership vs `form.organization_id`, bypass `is_published` when valid.
- Edge function `public-form-submit`:
  - Same token check; when valid, insert submission with `is_preview = true` and skip flow enrollment / notifications so drafts don't pollute live data.
- Token minting: a tiny new edge function `form-preview-token` (auth required) that returns a short-lived (e.g. 30 min) HMAC-signed token `{form_id, user_id, exp}` — avoids handing out raw JWTs and keeps the URL scoped to one form.

## Technical notes

- Token is signed with `SUPABASE_JWT_SECRET` (already available to edge functions) using HMAC-SHA256; format `base64url(payload).base64url(signature)`.
- Preview URL is copy-to-clipboard friendly but expires, so it can't be used as a stealth "public" link.
- No changes to RLS — everything stays behind edge functions using the service role.
- The existing publish toggle behavior is unchanged; the public link is still 404 for anonymous visitors until published.

## Out of scope

- Sharing preview links with non-members (would need per-recipient tokens).
- Persisting draft submissions long-term (they can be cleared with a "Delete preview submissions" action later if needed).

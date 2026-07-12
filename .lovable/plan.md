# Public Forms + Form Builder

Build a form builder that lets org admins create public sign-up forms. Each form is tied to a Flow + starting stage. Submissions create/merge a contact, enroll them in the flow, and notify the assignee.

## Database (new tables)

- `forms` — `id, organization_id, name, slug (unique), description, pipeline_id, stage_id, is_published, brand_color, logo_url, redirect_url, success_message, submission_count, created_by, created_at, updated_at`
- `form_fields` — `id, form_id, field_key, label, field_type (text|textarea|email|phone|number|date|select|radio|checkbox), options (jsonb), required, placeholder, help_text, sort_order`. Seeded with name/email/phone on create.
- `form_submissions` — `id, form_id, organization_id, contact_id, data (jsonb), ip, user_agent, created_at`

RLS: org admins manage forms; anon can `SELECT` a published form + its fields by slug; anon can `INSERT` submissions only via edge function (no direct table write). Grants tuned accordingly.

## Edge functions

- `public-form-get` (no JWT) — returns published form + fields by slug, plus org branding (name, logo).
- `public-form-submit` (no JWT) — validates payload (zod), honeypot + basic rate limit by IP, upserts contact by email/phone match within org (merge), inserts `form_submissions`, inserts `pipeline_contacts` at the form's stage, resolves assignee via stage default, writes a `notifications` row + `contact_interactions` entry for the assignee.

## Frontend — admin

- `src/pages/forms/FormsListPage.tsx` (`/forms`) — list, create, publish toggle, copy public link, copy embed snippet, view submissions count.
- `src/pages/forms/FormBuilderPage.tsx` (`/forms/:id`) — three panels:
  - Left: field palette (text, textarea, email, phone, number, date, select, radio, checkbox).
  - Middle: drag-to-reorder field list with inline edit (label, required, options for choice fields).
  - Right: settings — Flow picker (uses existing `pipelines` + `pipeline_stages`), starting stage, brand color, logo, success message / redirect URL, published toggle.
  - Live preview tab.
- `src/pages/forms/FormSubmissionsPage.tsx` (`/forms/:id/submissions`) — table of submissions with link to contact.
- Sidebar entry "Forms" gated behind a new `forms` org feature (OFF by default, consistent with recent feature-flag pattern).

## Frontend — public

- `src/pages/public/PublicFormPage.tsx` at `/f/:slug` — fetches via `public-form-get`, renders branded form (org logo + brand color), submits via `public-form-submit`, shows success state or redirects.
- Embed snippet: `<iframe src="https://app.flowleed.com/f/:slug?embed=1" ...>`; `?embed=1` strips outer chrome/padding.
- Honeypot hidden field + client zod validation mirroring server.

## Routing to Flow

Single flow + stage per form (v1). Conditional routing by field answer deferred to v2 — schema already supports it via optional `routing_rules jsonb` column on `forms` (nullable, unused in v1).

## Merge + notify

On submit, match existing contact by (email OR phone) within the org. If found: update blank fields only, add to flow if not already in it, create a notification for the stage's default assignee (or flow lead if none). If not found: create contact, enroll, notify.

## Out of scope for v1

Conditional routing, file uploads, payments, multi-page forms, CAPTCHA (honeypot + rate limit only).

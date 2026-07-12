
# Org-slug-first public URLs

Move public org pages to top-level org-slug URLs, dropping the `/org/` prefix:

- `/:orgSlug/content` — public stories library (was `/org/:slug/content`)
- `/:orgSlug/content/videos/:id` — public video (was `/org/:slug/content/videos/:id`)
- `/:orgSlug/groups` — public groups directory (was `/org/:slug/groups`)
- `/:orgSlug/f/:formSlug` — public form (was `/f/:slug`)

Form slugs become unique per org (so `connect-card` works for every church, no random suffix needed).

## Reserved slugs (critical)

The following top-level paths are owned by the app and must be blocked as org slugs. If an org already has one of these slugs, they keep working via the old `/org/:slug/...` routes but the new top-level route won't resolve for them.

Reserved list: `auth`, `verify-email`, `invite`, `pco`, `dev`, `fl-admin`, `audit`, `f`, `org`, `groups`, `content`, `flows`, `contacts`, `signals`, `messages`, `calls`, `tasks`, `team`, `integrations`, `analytics`, `profile`, `calendar`, `forms`, `api`, `admin`, `settings`, `dashboard`, `home`, `about`, `login`, `logout`, `signup`, `signin`.

Enforcement:
- DB CHECK constraint / trigger on `organizations.slug` rejecting the reserved list (case-insensitive).
- Frontend validation in the org rename dialog (`EditOrganizationDialog`) with a clear error message.
- Existing orgs are audited via a `read_query` — if any collide, we rename them (append `-org`) before enabling the new routes. (Migration includes the audit query but not automatic renames — we'll surface findings and rename manually.)

## Routing (`src/App.tsx`)

- Add public routes OUTSIDE the `ProtectedRoute`/`MainLayout` wrapper, placed AFTER all specific top-level routes so they don't shadow anything:
  - `/:orgSlug/content` → `PublicContentPage`
  - `/:orgSlug/content/videos/:id` → `PublicContentVideoPage`
  - `/:orgSlug/groups` → `GroupDirectoryPage`
  - `/:orgSlug/f/:formSlug` → `PublicFormPage`
- Keep old routes as permanent redirects:
  - `/org/:slug/content*` → `/:slug/content*`
  - `/org/:slug/groups` → `/:slug/groups`
  - `/f/:slug` → look up form's org slug via `public-form-get`, then redirect to `/:orgSlug/f/:formSlug`
- React Router matches most-specific first, so `/forms` still resolves to the internal `FormsListPage` even with `/:orgSlug/f/...` present. All app routes are protected and specific, so they take precedence. The reserved-slug rule guarantees `/:orgSlug` never means a real app route.
- NotFound (`*`) stays last — if `:orgSlug` doesn't resolve to a real org, the public page components show their existing "not found" state.

## Database

Migration:
- Drop the global-unique index on `forms.slug`.
- Add unique `forms(organization_id, slug)`.
- Add plain index on `forms.slug` for the legacy `/f/:slug` redirect lookup.
- Add validation trigger on `organizations` that rejects inserts/updates where `slug` is in the reserved list (case-insensitive).

No data backfill of existing form slugs — they still work; new forms just don't need the random suffix.

## Backend (edge functions)

- `public-form-get`: accept `org_slug` + `slug`, resolve org, then form by `(organization_id, slug)`. Keep legacy slug-only lookup path for redirects.
- `public-form-submit`: same shape — takes `org_slug` + `slug`. Legacy slug-only fallback for old links.
- Both still gate on `is_published = true`.

## Frontend components

- **`PublicFormPage.tsx`**: read `orgSlug` + `formSlug` from `useParams`, pass to both edge functions.
- **`FormsListPage.tsx`**: drop the `-${random}` suffix from `slugify` — use plain slug, on unique violation append `-2`, `-3`, … Copy-link uses `${origin}/${orgSlug}/f/${slug}`.
- **`FormBuilderPage.tsx`**: settings preview shows the canonical `${origin}/${orgSlug}/f/${slug}` URL.
- **`GroupDirectoryPage.tsx`** and **`PublicContentPage.tsx` / `PublicContentVideoPage.tsx`**: no logic changes (they already read `:slug` from params) — the route param name matches.
- **`EditOrganizationDialog.tsx`**: validate slug against the reserved list before submitting.

## Out of scope

- Custom subdomains (`groups.thepromisecenter.flowleed.com`) — separate effort.
- Auto-renaming existing colliding org slugs — surface via read_query first, then decide per org.

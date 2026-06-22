## Feature Module Assignment per Organization

Add ability for fl-admin super admins to enable/disable feature modules per organization. Modules gate UI (sidebar nav + page routes) so non-enabled features are hidden for that org.

### Initial Modules
- `texting` — SMS / Messages
- `calling` — Calls
- `flowleed_ai` — AI dashboard / suggestions
- `signals` — Signals page

(Easy to add more later.)

### Database
New table `public.organization_features`:
- `organization_id` (FK → organizations)
- `feature_key` (text)
- `enabled` (boolean, default true)
- unique (organization_id, feature_key)

RLS:
- Org members can SELECT their own org's rows (to gate UI)
- Only super admins (`system_user_roles`) can INSERT/UPDATE/DELETE

Helper RPC `get_org_features(_org_id uuid)` returning enabled map.

### Backend / Hook
- `src/lib/features.ts` — central FEATURE_MODULES registry (key, label, description, icon).
- `src/hooks/useOrgFeatures.tsx` — fetches enabled features for the current user's org, returns `{ isEnabled(key), features, isLoading }`.

### UI Gating (frontend only)
- `src/components/layout/Sidebar.tsx` — hide nav items for Messages (texting), Calls (calling), Dashboard AI widgets (flowleed_ai), Signals (signals) when disabled.
- Wrap corresponding routes/pages in `App.tsx` to redirect to `/` with a toast if disabled.

### fl-admin UI
- New component `src/components/admin/OrgFeatureModules.tsx`:
  - Lists FEATURE_MODULES with a Switch each.
  - Toggling upserts/deletes a row in `organization_features` (enabled flag).
  - Shows description + last updated.
- Mount inside `src/pages/admin/OrganizationDetailPage.tsx` as a new card "Feature Modules" near Phone Numbers section.

### Technical notes
- Default behavior: if no row exists for a (org, feature), treat as **enabled** (backwards compatible). Disabling creates a row with `enabled=false`.
- React Query cache key `['org-features', orgId]` invalidated on toggle.
- Module registry typed as `as const` for autocomplete.

### Out of scope
- Per-user feature toggles
- Billing/plan-tier driven feature bundles (can layer on later)

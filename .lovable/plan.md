## Goal

Add a "Planning Center Info" card on the contact profile (below Flow Moments) where each logged-in user picks which specific PCO custom fields they want to see, **and the order they appear**. Selection is per-user, so a Connections Pastor and a Worship Leader each see only the fields relevant to them.

## UX

**Card placement:** `UserProfilePage.tsx`, directly below `<FlowMomentsCard />`.

**Empty state (default for new users):**

- Card title: "Profile Insights"
- Body: "Pick the Planning Center fields you want to see for every contact."
- Primary button: **Configure fields**

**Configured state:**

- Compact key–value list rendered in the **user's saved order** (not grouped by tab — the user's priority wins).
- Each row: `Label: value`. Tab name shown as a small muted suffix (e.g. `Background Check Date · Background Check`) for context.
- Fields with no value render as `—`. Toggle "Hide empty fields" (default ON) hides them entirely.
- Top-right of the card: small **Edit** (pencil) button.

**Edit dialog** (`PcoFieldsPreferenceDialog`):

- Modal with search box at top.
- **Left panel — Available fields:** all PCO tabs as collapsible sections; each field has a checkbox. "Select all / Clear" per tab.
- **Right panel — Your selection (ordered):** the chosen fields as a draggable list (dnd-kit, already in the stack pattern). Drag to reorder. Click ✕ to remove.
- Footer: "Hide empty fields" switch, **Cancel**, **Save**.
- Saved selection is keyed to the current `user_id` + `organization_id`.

## Data

New table `user_pco_field_preferences`:

- `user_id uuid`, `organization_id uuid`
- `selected_field_ids text[]` — **ordered** array of PCO `field_definition` IDs (order = display order)
- `hide_empty boolean default true`
- Unique on (`user_id`, `organization_id`)
- RLS: user can read/write only their own row.

Field **definitions** (tabs + fields): reuse `usePcoCustomFields` / `pco-fetch-custom-fields`.

Field **values** per contact: new edge function `pco-fetch-contact-field-data` that, given a `contact_id`, calls PCO `/people/{pc_person_id}/field_data?include=field_definition` and returns `{ field_definition_id: value }`. Cached via React Query (5 min).

## Components / files

New:

- `src/components/contact/PcoCustomFieldsCard.tsx`
- `src/components/contact/PcoFieldsPreferenceDialog.tsx` (with dnd-kit reordering)
- `src/hooks/useUserPcoFieldPreferences.tsx`
- `src/hooks/useContactPcoFieldData.tsx`
- `supabase/functions/pco-fetch-contact-field-data/index.ts`
- Migration for `user_pco_field_preferences` + RLS

Modified:

- `src/pages/UserProfilePage.tsx` — render `<PcoCustomFieldsCard contactId={contactId} />` below `<FlowMomentsCard />`.

## Dependency

`@dnd-kit/core` + `@dnd-kit/sortable` (add if not already installed).

Ready to implement on approval.
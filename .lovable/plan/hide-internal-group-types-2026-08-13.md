# Hide internal group types

Add a per-type "Hidden" setting in Group Settings so internal types (e.g. Unique Groups, PCO-only types) never appear in public or member-facing places, while staff can still manage them on the Groups page.

## Behavior

A group type can be marked **Hidden**. Groups of that type are then removed from:
- Public group directory and its type filter chips
- Public group signup pages
- The Groups card on a person's/contact profile

They remain visible on the internal Groups page, with a "Show hidden types" toggle so staff can focus the list when they want.

This is separate from the existing Active/Disabled switch, which only controls whether the type can be picked when creating or editing a group.

New PCO-synced types arrive visible by default; you hide the internal ones manually.

## Where the setting lives

Group Settings > Types tab: each type row gets an eye icon toggle plus a "Hidden" badge, and the edit dialog gets a matching switch with a short explanation.

## Technical notes

- Migration: add `is_hidden boolean not null default false` to `group_type_definitions`.
- `useGroupTypes` — expose `is_hidden`; add a helper that returns the set of hidden type keys for filtering.
- `GroupSettingsPage.tsx` — eye toggle in the type list, switch in the edit dialog.
- `GroupDirectoryPage.tsx` — filter out groups whose `group_type` is hidden, before building the type filter chips.
- `GroupPublicSignupPage.tsx` / `group-public-signup` edge function — treat a hidden-type group as not publicly available.
- `ContactGroupsCard.tsx` — filter memberships whose group type is hidden.
- `GroupsPage.tsx` — keep hidden types listed, add a "Show hidden types" toggle (default on) so staff can collapse them.

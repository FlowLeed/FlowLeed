# Add Filter dropdown to Flows in sidebar

Replace the two existing inline icon toggles in the Flows section header (the user/users "my vs all" button and the star "pinned only" button) with a single **Filter icon** that opens a dropdown menu. Admins see one extra section.

## Filter dropdown contents

```text
View
  ◉ My flows
  ○ All flows

Show
  ☐ Favorites only

Team member            (admins only)
  ▼ Anyone
    Sarah K.
    Mike R.
    ...
```

- **View** (radio): "My flows" / "All flows" — replaces the current `showAllFlows` toggle.
- **Show → Favorites only** (checkbox): replaces the current `showPinnedOnly` star toggle.
- **Team member** (admins only, single-select submenu): "Anyone" plus each org member. When set, only flows where that user is on the flow team are shown.

A small dot/badge appears on the Filter icon when any non-default filter is active so it's discoverable that filters are applied.

## Technical plan

1. **`src/components/layout/Sidebar.tsx`**
   - Replace `Users`/`User` toggle and `Star` toggle in the Flows section header with a single `<DropdownMenu>` triggered by a `Filter` lucide icon button (same `h-6 w-6` styling).
   - Use `DropdownMenuRadioGroup` for View, `DropdownMenuCheckboxItem` for Favorites, and a `DropdownMenuSub` for Team member (rendered only when `isOrgAdmin`).
   - Add new state `const [teamMemberFilter, setTeamMemberFilter] = useState<string | null>(null);` alongside existing `showAllFlows` / `showPinnedOnly`.
   - Extend the existing filtering block (lines ~550–562) so that after computing `displayedFlowItems`, when `teamMemberFilter` is set we further restrict to flows where that user is on `pipeline_team_members`.
   - Update `SidebarSectionProps` to pass a single `filterControl?: ReactNode` instead of the four boolean toggle props (cleaner) — header just renders it next to the Settings gear.

2. **Admin detection** — new lightweight hook `src/hooks/useIsOrgAdmin.tsx`:
   - Reads `organization_members.role` for the current user (mirrors the pattern used at `FlowContext.tsx:133`).
   - Returns `{ isOrgAdmin: boolean }` where `role IN ('owner', 'admin')`.
   - Cached via React Query (`['org-role', userId]`).

3. **Org members list for the submenu** — new hook `src/hooks/useOrgMembers.tsx` (only enabled when `isOrgAdmin`):
   - Joins `organization_members` → `profiles` for the current user's org and returns `{ user_id, full_name, avatar_url }[]` sorted by name.

4. **Team-member filtering data** — extend `useMyFlows` is not appropriate (it's user-scoped). Instead, fetch flow → team-member mapping once and reuse:
   - New hook `src/hooks/useFlowTeamMemberships.tsx` (admin-only, enabled when filter is active): returns `Map<userId, Set<pipelineId>>` from `pipeline_team_members`.
   - Sidebar uses `flowsByMember.get(teamMemberFilter)` to filter `displayedFlowItems`.

5. **Persistence (optional, recommended)** — store the three filter values in `localStorage` keyed by user id so the choice survives reloads, matching the implicit feel of the current toggles. No DB changes.

6. **Active-state indicator** — add a small purple dot via an absolutely positioned `<span>` on the Filter button when `showAllFlows || showPinnedOnly || teamMemberFilter`.

## Files touched

- `src/components/layout/Sidebar.tsx` — swap toggles for the Filter dropdown, add new state, extend filtering.
- `src/hooks/useIsOrgAdmin.tsx` — new.
- `src/hooks/useOrgMembers.tsx` — new.
- `src/hooks/useFlowTeamMemberships.tsx` — new.

## Out of scope

- Moving the Settings gear, drag-to-reorder, or pin behavior on individual flow rows — all preserved as-is.
- Saving filters to a database table (using localStorage instead).
- Filtering by flow type (linear/recurring) or status — easy to add later inside the same dropdown if you want.

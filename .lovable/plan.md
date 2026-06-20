## Redesigned Tasks Page

Replace the current Tasks page (metrics + upcoming tasks + needs attention + team feed) with a focused, single-purpose page: **a complete list of every contact assigned to the current user**, with search and filters.

### Page layout

```text
┌─────────────────────────────────────────────────────────┐
│ Header: "My Contacts"   [count badge]                   │
├─────────────────────────────────────────────────────────┤
│ Personal Metrics (compact, kept from current page)      │
├─────────────────────────────────────────────────────────┤
│ [🔍 Search by name...]                                  │
│ [Flow ▾] [Stage ▾] [Campus ▾] [Sort: last contact ▾]   │
├─────────────────────────────────────────────────────────┤
│ Avatar  Name              Flow · Stage     12d ago  →   │
│         engagement badge   campus                       │
│ Avatar  Name              Flow · Stage      3d ago  →   │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

### Contact source ("assigned to me")

Union of:
1. `pipeline_contacts.assigned_to_user_id = me` (active, not completed)
2. `pipeline_stages.default_assignee_user_id = me` for stages currently occupied by a contact (only when that `pipeline_contact` has no explicit assignee — i.e. effective assignment)
3. `contact_interactions.assigned_to_user_id = me` with `completed_at IS NULL` (open task on the contact)

Deduplicate by `contact_id`. Each contact appears once; its primary flow/stage is the most recently entered active `pipeline_contact`.

### Row content

- Avatar + name (links to `/contacts/:id`)
- Flow badge with icon + stage badge (colored left border) — reuses pattern from `TaskContactRow`
- Engagement badge (compact)
- Campus chip (small, muted) when present
- Right side: "Xd ago" badge based on last `contact_interactions.created_at`; "No contact" if none. Color: destructive ≥30d, secondary ≥14d, outline otherwise.

### Filters & search

- **Search**: client-side substring match on name (case-insensitive).
- **Flow filter**: dropdown of distinct flows present in the result set.
- **Stage filter**: dropdown of stages within the selected flow (or all stages when no flow selected).
- **Campus filter**: dropdown of distinct campuses present.
- **Sort**: "Last contact (oldest first)" default, "Name A–Z", "Recently assigned".
- All filters operate client-side on the fetched dataset (assumed ≤ a few hundred rows per user; matches current Tasks page pattern).

### Removed from the page

- `My Upcoming Tasks` card (scheduled interactions list)
- `People I Need to Connect With` section (subsumed — that list is now a sort/filter of the same dataset)
- `Team Activity Feed`

`PersonalMetrics` is kept at the top as a compact summary.

### Technical implementation

**New hook**: `src/hooks/useMyAssignedContacts.tsx`
- Single React Query keyed on `userId`.
- Three parallel Supabase queries:
  - `pipeline_contacts` where `assigned_to_user_id = userId` and `completed_end_at is null`, selecting `contact_id, pipeline_id, stage_id, created_at`.
  - `pipeline_stages` where `default_assignee_user_id = userId`, then `pipeline_contacts` in those stages with `assigned_to_user_id is null` and `completed_end_at is null`.
  - `contact_interactions` where `assigned_to_user_id = userId` and `completed_at is null`, selecting `contact_id`.
- Collect unique `contactIds`, then batch-fetch:
  - `contacts` (id, name, avatar, email, campus_id)
  - `campuses` (id, name) for the referenced campus ids
  - `pipelines` (id, name, icon)
  - `pipeline_stages` (id, name, color, stage_order, pipeline_id) — for both the primary stage and next-stage lookup
  - `contact_interactions` (contact_id, created_at) for last-contact computation
- Build `MyAssignedContact[]` mirroring `TaskContact` shape, adding `campusName`.

**New page sections**:
- `src/pages/TasksPage.tsx` rewritten.
- `src/components/tasks/MyContactsFilters.tsx` (search input + 3 selects + sort select).
- Reuse `TaskContactRow` (already shows flow/stage/engagement badges). Extend it with optional campus chip, or add `campusName` to the existing row.

**Untouched**:
- `useTasksPageData`, `useAllScheduledTasks`, `useMyUpcomingTasks`, `useDashboardData` remain (used by Dashboard and other pages).
- No DB migrations. No edge function changes. Sidebar nav unchanged.

### Empty / loading states

- Loading: `Skeleton` rows (8 placeholders).
- Empty (no assignments): friendly message "No contacts assigned to you yet."
- Empty after filters: "No contacts match your filters." with a "Clear filters" button.

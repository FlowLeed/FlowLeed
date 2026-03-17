

## Why Filters Are Missing on "Team Care"

The **Team Care** flow has no team members in the `pipeline_team_members` table. The Header component conditionally renders the `FlowHeaderFilters` button only when `teamMembers.length > 0`:

```tsx
{teamMembers.length > 0 && contactCounts && onFilterChange && (
  <FlowHeaderFilters ... />
)}
```

Since there are no team members, the entire filter UI (including Show Completed, Engagement, and Campus filters) is hidden.

## Plan

**Change the condition in `src/components/layout/Header.tsx`** to always show the filter button when `contactCounts && onFilterChange` are provided, removing the `teamMembers.length > 0` gate. The "Assigned to" section inside `FlowHeaderFilters.tsx` can still conditionally render based on whether team members exist.

### Files to edit:

1. **`src/components/layout/Header.tsx`** (~line 416): Remove `teamMembers.length > 0` from the render condition — change to `contactCounts && onFilterChange`.

2. **`src/components/crm/FlowHeaderFilters.tsx`**: Wrap the "Assigned to" section (~lines 96-130) in a conditional `{teamMembers.length > 0 && (...)}` so it only appears when there are team members, while the rest of the filters (Show Completed, Engagement, Campus) always show.


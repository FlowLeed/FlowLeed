

## Redesign Flows Section Header with Filter Icons

**Current state**: The Flows section header has "FLOWS" on the left and a settings gear icon on the right. Below flows, there's a "Show all flows" text toggle. Pinned flows have a "PINNED" label above them.

**Proposed change**: Remove the "PINNED" label and the bottom text toggle. Instead, add two small icon buttons next to the settings gear in the "FLOWS" header row:

1. **My/All toggle** (e.g., `User` / `Users` icon) — toggles between showing only my flows vs all flows. Active state uses a filled/highlighted style.
2. **Pinned/All toggle** (e.g., `Star` icon) — when active, shows only pinned flows; when inactive, shows all (respecting the My/All filter). Active state shows a filled star.

This makes sense — it consolidates three UI elements (PINNED label, divider, bottom toggle) into two compact icons in the header, keeping the sidebar clean at scale.

```text
FLOWS          [👤] [⭐] [⚙]
  Flow A
  Flow B
  ...
```

### Technical changes

**File: `src/components/layout/Sidebar.tsx`**

1. Add a new prop `showPinnedOnly` + `onTogglePinnedOnly` to `SidebarSectionProps` and the `Sidebar` component state.

2. In the header row (lines 333-341), add two icon buttons before the settings gear:
   - `User`/`Users` icon for My/All toggle (calls `onToggleShowAll`)
   - `Star` icon for Pinned-only filter (calls `onTogglePinnedOnly`)
   - Both use subtle styling: ghost variant, highlighted when active.

3. Remove the "PINNED" label block (lines 449-458) — pinned flows will just show with filled stars inline, no separate section.

4. Remove the bottom "Show all flows" text toggle (lines 465-472).

5. Update filtering logic:
   - When pinned-only is active: show only pinned flows
   - When pinned-only is off + "my flows": show unpinned flows where user is a team member, plus pinned flows mixed in
   - When pinned-only is off + "all flows": show all flows
   - Pinned flows always show their filled star icon regardless of filter mode.

### Summary
Remove the "PINNED" subsection label and bottom toggle text. Replace with two icon buttons in the FLOWS header row for compact, intuitive filtering.


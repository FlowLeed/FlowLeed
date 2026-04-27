

## Improve mobile view for the Flow header

At 390px the header is broken: the title "New Family Follow-Up" wraps to 3 lines and crashes into the toolbar icons sitting on the same row, the icon row overflows and pushes the avatar past the edge, and the kanban columns underneath are too narrow to read.

### Changes

**1. `src/components/layout/Header.tsx` — restructure the header for mobile**

Today the header is one flex row containing: hamburger + flow icon + title + toolbar icons + notifications + search + avatar. On mobile this overflows.

Restructure into two zones:
- **Top row (always visible)**: hamburger, flow icon, title (truncated with `truncate` + `min-w-0`), and the persistent right cluster (notifications, search, avatar). Title takes `flex-1 min-w-0` so it never wraps — it ellipsizes.
- **Toolbar cluster (Settings, View toggle, Select, Filter, Docs)**: on `md:` and up, render inline as today. On mobile (`<md`), collapse them into a single overflow `MoreHorizontal` icon button that opens a `DropdownMenu` listing each action with its label ("Settings", "Switch to table view", "Select", "Filter", "Docs"). Filter still shows its active-state dot on the trigger.
- Reduce horizontal padding on mobile (`px-2`) and tighten gaps so the right cluster fits.

**2. `src/components/crm/FlowHeaderFilters.tsx` — mobile-friendly popover**

The filter popover is `w-80` (320px) which barely fits at 390px and overflows when the trigger lives inside an overflow menu. Change to `w-[calc(100vw-1.5rem)] max-w-sm` so it stays inside the viewport with margin on both sides. Keep desktop behavior unchanged via the `max-w-sm` cap.

**3. `src/components/crm/FlowView.tsx` — kanban → single-column stack on mobile** (verify file then adjust)

On mobile the multi-column kanban is unusable. Either:
- (a) Force the table view as default when `useIsMobile()` is true and hide the kanban toggle, OR
- (b) Render kanban stages as a vertical accordion stack (one stage open at a time) on `<md`.

I'll go with (a) — simpler, matches existing table view, and the user can still toggle back. The view toggle button stays available in the overflow menu.

### Result

```text
Mobile (390px):
┌────────────────────────────────────────┐
│ ☰  ⚙ New Family Follow-Up… ⋯ 🔔 🔍 │ AY │
└────────────────────────────────────────┘
                        ↑ overflow menu

Desktop (≥768px):  unchanged
┌──────────────────────────────────────────────────────────┐
│ New Family Follow-Up  ⚙ ⊞ ☑ ▽ 📖    🔔 🔍 │ AY     │
└──────────────────────────────────────────────────────────┘
```

Title never wraps, icons never overflow, popovers fit the screen, and the default mobile view is the readable table.


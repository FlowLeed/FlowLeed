
## Unify the Flow toolbar styling

The toolbar above the kanban (settings, view toggles, select mode, Filter, Docs, notification bell, search, avatar) currently mixes three visual styles: bordered icon-group pills, bordered text+icon buttons (Filter, Docs), and bare ghost icon buttons (bell, search). I'll normalize them into one consistent system.

### Design system for toolbar

- **Single button shape**: all toolbar controls become 32×32 square icon buttons (`h-8 w-8`), `variant="ghost"`, `rounded-md`, with subtle hover (`hover:bg-slate-100`). Same color, same icon stroke (`h-4 w-4`, `text-slate-600`).
- **Grouped controls** (kanban/table toggle, select mode) keep their bordered "segmented control" container but use the same inner button sizing as standalone buttons for visual rhythm.
- **Filter & Docs**: drop the text labels — use only the icon (`Filter`, `BookOpen`) to match the bell/search pattern. Keep the small count badge on Filter as a tiny dot/number overlay in the corner instead of an inline pill.
- **Tooltips**: every icon-only button gets a `Tooltip` ("Filter", "Docs", "Notifications", "Search", "Settings", "Grid view", "Table view", "Select") so discoverability isn't lost.
- **Spacing**: replace mixed `gap-1` / `gap-2` / `ml-2` with a single `gap-1` flex row, with a thin `border-l` divider before the avatar (same divider already used before the avatar).

### Files to change

1. **`src/components/layout/Header.tsx`**
   - Wrap Settings, view toggle buttons, select toggle, NotificationBell, Search button in `Tooltip` and standardize to `h-8 w-8 ghost rounded-md`.
   - Remove the `Docs` text — render as `<Button variant="ghost" size="icon">` with `BookOpen` icon + tooltip.
   - Tighten the outer flex container to a single `gap-1` row.

2. **`src/components/crm/FlowHeaderFilters.tsx`**
   - Change the `PopoverTrigger` button to icon-only (`size="icon"`, `variant="ghost"`, `h-8 w-8`), remove "Filter" text.
   - Replace inline count badge with a small absolutely-positioned dot in the top-right corner when `hasActiveFilter` is true (showing the count if >1, else just a dot).
   - Wrap in `Tooltip` ("Filter").

3. **`src/components/notifications/NotificationBell.tsx`** (verify only)
   - Confirm sizing matches `h-8 w-8`; adjust if it's currently larger so it aligns with the new row.

### Result

The toolbar reads as one cohesive icon row: `[settings] [grid|table] [select] [filter•] [docs] [bell] [search] | [AY]` — same height, same hover, same weight — instead of today's mix of pills, text buttons, and bare icons.

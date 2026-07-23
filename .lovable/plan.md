## Redesign: Bulk Actions Toolbar

Rework `BulkActionsToolbar` from a wide, overflowing outline-button bar into a compact dark "segmented dock" with clear visual grouping, better hierarchy, and consolidated tag actions.

### UX improvements
- **Compact footprint**: Icon+short-label for primary actions, icon-only for secondary — fits without horizontal overflow at typical widths.
- **Selection badge**: Count shown in a filled circle chip ("3 selected") instead of a full sentence.
- **Grouping via segments** (left → right):
  1. Selection status (count + "selected")
  2. Movement group (Change Step, Move to Flow) — pill-grouped, primary emphasis with accent icon color
  3. Tags group — consolidated into a single "Tags" button opening a small popover with Add / Remove options (removes the duplicated buttons)
  4. Assignment (Reassign) — icon button
  5. Utility & destructive segment (Export CSV icon, Delete in danger-tinted button) — separated by a divider
  6. Clear-selection close button on the far right
- **Destructive affordance**: Delete uses a red-tinted background that intensifies on hover; separated from neutral actions by a divider.
- **Tooltips** on all icon-only buttons (Reassign, Tags, Export, Delete, Close) so labels remain discoverable.
- **Responsive**: Toolbar keeps `max-w-[640px]`, uses `mx-4`, and inner action row uses horizontal scroll with hidden scrollbar as a safety net for very narrow viewports.

### Visual direction
Dark segmented dock matching the selected prototype:
- Container: `bg-slate-900/95 backdrop-blur-xl`, `ring-1 ring-white/10`, `border border-slate-700/50`, `rounded-2xl`, `shadow-2xl`, height ~56px.
- Movement group nested in a subtle `bg-slate-800/50 rounded-xl` sub-pill.
- Accent icons in `text-blue-400` for primary actions.
- Delete: `bg-red-500/10 text-red-500` → `hover:bg-red-500 hover:text-white`.
- Fixed at `bottom-8 left-1/2 -translate-x-1/2`.

### Files to change

**`src/components/crm/BulkActionsToolbar.tsx`** (rewrite the render only; keep all props & handlers)
- Replace the current white outline-button bar with the segmented dark dock layout.
- Merge Add Tags + Remove Tags into one "Tags" button using an existing shadcn `Popover` (or `DropdownMenu`) with two items: "Add tags…" and "Remove tags…" — each opens the same existing `BulkTagDialog` in the correct mode.
- Convert Reassign, Export CSV, Delete, and Clear into icon-only buttons wrapped in shadcn `Tooltip`.
- Keep Change Step & Move to Flow as icon+label (short labels: "Step", "Flow" with tooltips showing the full name — or keep full labels; will use full labels for clarity).
- No changes to dialogs, handlers, or business logic.

### Out of scope
- No changes to `useBulkActions`, dialogs, or FlowView data flow.
- No changes to mobile-specific behavior beyond current responsive constraints.
- No new features — only visual/UX refinement of the existing toolbar.

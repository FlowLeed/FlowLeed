# Redesign Group Detail Page

## Goal
Refresh the Group Detail page (`src/pages/GroupDetailPage.tsx`) so the group image is larger and the overall layout feels more polished, while keeping the existing compact dashboard density and balancing the image with key information.

## Design Direction

Based on the selected preferences:
- **Hero image treatment**: Side-by-side split — a large image block on the left, group name / type / description / quick actions on the right.
- **Layout density**: Compact dashboard — stats, members, and meetings remain in tight, scannable cards without excessive whitespace.
- **Visual emphasis**: Balanced — image and key info share the spotlight; neither dominates.

### Specific changes

1. **Split hero section**
   - Replace the current small-avatar Card header with a two-column hero.
   - Left column: large group image using `GroupAvatar` at a new `2xl` size (or a dedicated hero image component) with rounded corners and a subtle shadow. If no image exists, show initials at a much larger scale inside a colored placeholder.
   - Right column: group name, type badge, description (clamped to 4–5 lines), leader row, and action buttons (Share, Requests, Edit) in a compact horizontal row.

2. **Compact dashboard stats**
   - Keep the existing 3-column info cards (Members, Meeting Time, Location) but refine their visual hierarchy:
     - larger numbers
     - smaller muted labels
     - consistent card height and padding.
   - If a stat is missing, the card gracefully collapses or hides so the grid remains balanced.

3. **Members & Meetings tabs**
   - No structural change; keep the tab switcher.
   - Add small visual polish: consistent card padding, hover states on member rows, and clearer attendance badges.

4. **Responsive behavior**
   - On desktop (`md` and up): side-by-side split hero.
   - On mobile: stack image above the info, image becomes full-width, info stays compact.

## Files to modify

- `src/pages/GroupDetailPage.tsx` — hero redesign, responsive layout, card polish.
- `src/components/groups/GroupAvatar.tsx` — add a new `2xl` size for the large hero image.
- `src/index.css` — only if new spacing/typography tokens are needed; otherwise reuse existing Tailwind tokens.

## Out of scope

- No new database fields or API changes.
- No changes to group creation/editing dialogs.
- No global design-system color or font changes.

## Success criteria

- The group image is significantly larger than the current 64×64 avatar.
- The hero uses a side-by-side layout on desktop and stacks on mobile.
- The page remains compact and dashboard-like.
- Image and info feel balanced.
- Build passes with no new errors.

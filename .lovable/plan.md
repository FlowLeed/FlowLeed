# Compact tablet and desktop layout

## Goal
Restore the older, denser FlowLeed feel on iPads and desktop while keeping the improved phone experience easy to tap and read.

## Plan

### 1. Make the shared frame compact above phone sizes
- Reduce the fixed sidebar from its current 288px width to a narrower tablet/desktop width, with a slightly roomier option on very large screens if needed.
- Tighten sidebar logo spacing, section spacing, navigation-row height, icon gaps, and horizontal padding.
- Keep the current mobile drawer width and 44px phone touch targets unchanged.

### 2. Tighten tablet and desktop headers
- Reduce header height and horizontal padding from the tablet breakpoint upward.
- Keep titles, notifications, search, and account actions aligned without shrinking their usable click areas too far.
- Preserve the simplified phone header.

### 3. Restore denser page content
- Reduce oversized tablet/desktop page gutters and vertical gaps in shared page layouts.
- Make FlowLeed AI match the older composition more closely: compact intro spacing, a slightly narrower prompt box, and tighter category controls.
- Tighten repeated Flow rows, people rows, filters, and toolbars where the shared spacing currently makes screens feel stretched.

### 4. Apply responsive density deliberately
- Phone: retain the current touch-friendly layout.
- iPad/tablet: compact navigation and content while preserving comfortable touch targets.
- Desktop: use the densest layout and show more information without crowding.

### 5. Verify the result
- Compare the FlowLeed AI screen and a Flow at tablet and desktop widths against the supplied older screenshot.
- Check long Flow names, badges, headers, menus, and toolbars for clipping or overlap.
- Confirm mobile widths remain unchanged and the app still builds cleanly.

## Technical notes
- Use shared responsive spacing and width tokens rather than one-off page overrides.
- Keep the existing colors, typography, features, and data behavior unchanged.
- Scope is visual density only; no workflow or backend changes.



## Mobile-Friendly Navigation Plan

### Problem
The sidebar is fixed at `18rem` (288px) and always visible. On screens <768px it eats most of the viewport, leaving content unusable. The Header also needs a way to open the sidebar on mobile.

### Approach
Convert the sidebar into a **slide-out drawer on mobile** (<768px) while preserving the existing fixed sidebar on desktop. Use a hamburger menu in the Header on mobile to toggle it.

### Changes

**1. `src/components/layout/Sidebar.tsx`**
- Wrap the sidebar `<div>` in conditional rendering using `useIsMobile()`:
  - **Desktop (≥768px)**: render as today (fixed left column).
  - **Mobile (<768px)**: render inside a `Sheet` (shadcn) sliding from the left, full sidebar content unchanged.
- Expose `open`/`onOpenChange` via a lightweight context (`MobileSidebarContext`) so Header can toggle it.
- Auto-close the sheet on route change (listen to `useLocation`).

**2. `src/components/layout/MainLayout.tsx`**
- Wrap with `MobileSidebarProvider` so both Sidebar (sheet) and Header (trigger) share state.
- On mobile, the Sidebar no longer occupies layout space — main content gets full width.

**3. `src/components/layout/Header.tsx`**
- Add a hamburger (`Menu` icon) button visible only on mobile (`md:hidden`) at the far left.
- Clicking it opens the mobile sidebar sheet.

**4. `src/components/admin/SuperAdminLayout.tsx` + `SuperAdminSidebar.tsx`**
- Apply the same pattern (mobile sheet + hamburger in `SuperAdminHeader`) so the admin area is mobile-friendly too.

**5. Small layout polish**
- Header padding: tighten `px-6` → `px-4 md:px-6` on mobile.
- Dashboard `max-w-4xl mx-auto px-6` already responsive — verify spacing on 375px.
- ImpersonationBanner: ensure it stacks nicely above hamburger.

### What we keep
- Desktop layout, sidebar styling, all flow/pin logic — completely unchanged.
- Same component tree, just wrapped differently per breakpoint.
- Uses existing `useIsMobile` hook and `Sheet` component (already in project).

### Out of scope (next phases)
- Page content responsiveness (Dashboard chat, Flows board, Tables) — separate plans per page.
- Bottom-nav alternative — can revisit if you prefer that pattern later.

### Quick visual

```text
Mobile (<768px)                  Desktop (≥768px)
+------------------+             +--------+--------------+
| ☰  Header   🔔  |             |  Side  | Header   🔔  |
+------------------+             |  bar   +--------------+
| Main content     |             |  ...   | Main content |
|                  |             |        |              |
+------------------+             +--------+--------------+
   ↑ tap ☰ → sheet slides in from left
```


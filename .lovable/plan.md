## What's wrong

Your screenshots show the same root issue on every page: page content is **wider than the iPhone viewport**, so the inner scroll container is letting users scroll horizontally without realizing it (scrollbars are hidden globally). That's why content looks shifted — labels like "Email:", "Phone:", "Gender:" are clipped on the **left** while "Salvation Decision", "Send", "Team", "Stop", "New conversation" are clipped on the **right**. Combine that with mobile padding designed for desktop (`px-6` everywhere) and the UI feels squeezed on a 390px screen.

After auditing the codebase the offenders fall into 4 groups:

1. **Scroll containers permit horizontal scroll.** `MainLayout`'s outlet wrapper, `Dashboard`'s `flex-1 overflow-auto`, `UserProfilePage`'s `overflow-auto`, and similar wrappers use `overflow-auto` / `overflow-hidden` on the parent but don't lock the X axis on the actual scroller. Any descendant that's even 1px too wide makes the whole page horizontally scrollable.
2. **Fixed widths that don't fit mobile.** `BulkActionsToolbar` uses `min-w-[600px]` (wider than any phone). A few search/filter inputs use `min-w-[200px]` / `min-w-[220px]` inside flex rows that don't wrap cleanly. Sidebar pinned-flow filter button and notification overlays use desktop spacing.
3. **Desktop-only padding on mobile.** `Dashboard`, `UserProfilePage`, and a few other pages use `px-6 py-6` unconditionally — 48px of horizontal padding eats a chunk of a 390pt screen. Headers use `gap-2` toolbars with too many buttons visible at once.
4. **Unbreakable strings.** Long emails, URLs, and PCO field values don't get `break-words` / `min-w-0`, so a single long string forces the parent wider than the screen.

## Plan

### 1. Lock horizontal scroll on the main scroll containers

Add `overflow-x-hidden` (or switch `overflow-auto` → `overflow-y-auto`) on the wrappers that actually scroll. This is the single fix that stops the "shifted page" symptom across every screen:

- `src/components/layout/MainLayout.tsx` — outlet column
- `src/pages/Dashboard.tsx` — the `flex-1 overflow-auto hide-scrollbar` div
- `src/pages/UserProfilePage.tsx` — the `flex-1 overflow-auto w-full p-4 md:p-6` div
- Spot-fix any other page-level scrollers that use `overflow-auto` (Contacts, Tasks, Messages, Calls, Analytics, Groups, GroupDetail, ChurchOnlineAdvanced, FlowPage)

### 2. Tighten mobile spacing

- `Dashboard.tsx`: `max-w-4xl mx-auto px-6 py-6` → `px-4 md:px-6 py-4 md:py-6`
- Sticky bottom input wrapper (when in chat mode): `px-6 py-4` → `px-3 md:px-6 py-3 md:py-4`
- `UserProfilePage` outer scroller already uses `p-4 md:p-6` — keep, but verify inner cards use `p-4 md:p-6` too
- `Header.tsx`: confirm `px-2 md:px-4` stays and check the bell + search icons aren't pushing the title off-screen on narrow widths

### 3. Audit + fix the fixed-width offenders

- `src/components/crm/BulkActionsToolbar.tsx` — `min-w-[600px]` → `min-w-0 w-[min(600px,calc(100vw-2rem))]` so it shrinks to fit the phone
- `src/pages/GroupsPage.tsx` and `src/components/contacts/ContactFilters.tsx` — `min-w-[200px]` / `min-w-[220px]` search inputs: change to `min-w-0 sm:min-w-[220px]` so they collapse on mobile
- Verify the desktop-only `Sidebar` block (`w-[var(--sidebar-width)] min-w-[var(--sidebar-width)]`) stays unreachable on mobile (it already returns early via `isMobile`, but I'll double-check the `useIsMobile` breakpoint matches Tailwind's `md`)

### 4. Make long strings safe

- Email / phone / PCO custom field values in `UserProfilePage` and `PcoCustomFieldsCard` — wrap value spans with `break-all` / `min-w-0` so a long token can't force the card wider than the screen
- Notification dropdown items, search results, and chat message bubbles get `min-w-0` + `break-words`

### 5. Verify on real mobile viewports

After the fixes, walk through these pages at 390×844 (iPhone 14) and 360×800 (smaller Android) in the preview:

- `/` (Dashboard) hero state — chips wrap, Send button fully visible, no horizontal scroll
- `/` after sending a message — sticky bottom input, Stop button fully visible, "New conversation" header fits
- `/user/:id` (Chadwick King-style profile) — engagement stats row stays inside the card, contact info labels not clipped, Flow Moments still swipeable
- `/flows/:id` Kanban — columns scroll horizontally inside the page area, NOT the whole page
- `/contacts`, `/tasks`, `/messages`, `/groups` — table/list rows respect viewport width

## Technical details

```text
Symptom chain (each user-visible bug → root cause):
  • Labels clipped on left  ──┐
  • Buttons clipped on right ─┼─→  page is horizontally scrollable
  • Chips don't wrap         ─┘    └─→ scroll container uses `overflow-auto`
                                       AND a descendant exceeds viewport width
                                       (BulkActionsToolbar min-w[600], long emails,
                                        oversized search inputs, px-6 on mobile)
```

Files most likely to change:
- `src/components/layout/MainLayout.tsx`
- `src/components/layout/Header.tsx` (mobile spacing tweak only)
- `src/pages/Dashboard.tsx`
- `src/pages/UserProfilePage.tsx`
- `src/pages/ContactsPage.tsx`, `TasksPage.tsx`, `MessagesPage.tsx`, `GroupsPage.tsx`, `FlowPage.tsx`, `AnalyticsPage.tsx` (only the page-level scroll wrapper)
- `src/components/crm/BulkActionsToolbar.tsx`
- `src/components/contacts/ContactFilters.tsx`
- `src/components/dashboard/AIChatInput.tsx` (verify button doesn't get clipped under narrow widths)
- `src/components/contact/PcoCustomFieldsCard.tsx` (long-value break)

No design-system token changes, no animation work, no behavior changes — purely responsive CSS + container hygiene.

## Out of scope

- Redesigning the contact profile layout for mobile (the current stacked design is fine once the overflow stops)
- Building a bottom-tab nav for mobile (sidebar Sheet stays as-is)
- Theming / color changes
- PWA install behavior (covered separately)

If you'd rather I also do a mobile-first redesign pass on the contact profile or the dashboard hero, say the word and I'll plan that as a follow-up.

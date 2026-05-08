
# Church Heartbeat on Analytics

Add a hero card at the top of `/analytics` that shows the church's engagement "heartbeat": one row per engagement level (Highly Engaged, Active, At Risk, Inactive, New) with a label, descriptor, count, and a horizontal progress bar. Clicking a row deep-links to the People page pre-filtered by that engagement level.

The data already exists — `useOrgCheckinStats` returns `engagementDistribution` keyed by level, and `ContactsPage` already supports an `engagementLevel` filter. No new backend work needed for Phase 1.

---

## Phase 1 — Heartbeat card (frontend only)

**New component:** `src/components/analytics/HeartbeatCard.tsx`
- Props: `campusId?: string | null`
- Uses `useOrgCheckinStats(orgId, campusId)` (already in project)
- Layout matches the reference screenshot:
  - Header: "Church Heartbeat" + total people on the right (`{total} people`)
  - One row per level with: bold label, muted descriptor on the right, full-width `Progress` bar below (count / max across levels = bar value)
- Levels (top → bottom) and copy:
  - **Highly Engaged** — "Engaged, serving, connected"
  - **Active** — "Showing up consistently"
  - **At Risk** — "Missed check-ins, fading signals"
  - **Inactive** — "Needs a personal call"
  - **New** — "Recently joined the family"
- Each row is a `button` → navigates to `/contacts?engagementLevel=<level>`
- Loading state via `Skeleton`; empty state mirrors `AttendanceSection`'s "no check-in data" message
- Styling: semantic tokens only (`bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary` for bars). No hardcoded colors.

**Wire-up:** `src/pages/AnalyticsPage.tsx`
- Render `<HeartbeatCard campusId={selectedCampusId} />` directly under the filters row, above the `Tabs`.

**Deep-link support:** `src/pages/ContactsPage.tsx`
- On mount, read `?engagementLevel=` from the URL (via `useSearchParams`) and seed the `engagementLevel` filter if the value is one of the known levels.
- No other behavior change.

**Acceptance**
- Card appears on Analytics, shows real counts pulled from existing RPC.
- Bars are proportional to the largest level.
- Clicking a row lands on `/contacts` with the matching engagement filter active.
- Respects the existing campus filter on Analytics.

---

## Phase 2 — Polish & motion

- Subtle bar fill animation on first render (framer-motion, already used in project).
- Hover state on rows (raise + show "View people →" affordance).
- Tooltip on each bar with exact count + % of total.
- Add a "Total scored" vs "Unscored" footer line so the math is transparent (reuses values already computed in `AttendanceSection`).
- Optional toggle: "Show as %" / "Show counts".

---

## Phase 3 — Trends (requires light backend work)

Goal: show whether the heartbeat is improving or declining.

- New RPC `get_org_engagement_distribution_snapshot(p_org_id, p_as_of date, p_campus_id)` OR a daily snapshot table `org_engagement_snapshots(org_id, campus_id, snapshot_date, level, count)` populated by a pg_cron job (pattern already used elsewhere in the project — see DB Maintenance memory).
- Heartbeat card shows a small delta per row vs 30 days ago (e.g. `At Risk · +12 ↑`, colored red when bad-direction, green when good-direction).
- Add a tiny sparkline per row using the snapshot history.

---

## Phase 4 — Actionability

- Each row gets a secondary action: "Start a follow-up flow" → opens the existing AddToFlowDialog pre-scoped to the filtered cohort (bulk add).
- Surface the Heartbeat card on the Dashboard too (compact variant, no descriptors) so leaders see it on login.
- Optional: weekly "Heartbeat digest" email reusing `send-daily-digest` infra.

---

## Technical notes

- No new tables in Phase 1/2.
- Reuses: `useOrgCheckinStats`, `Progress`, `Skeleton`, `Card`, semantic tokens.
- Engagement level keys must stay in sync with `useCheckinData.tsx` (`highly_engaged | active | at_risk | inactive | new`) and the `engagementLevel` values accepted by `ContactFilters.tsx`. We'll verify the exact strings before wiring the filter.
- Phase 3 is the only phase that requires a Supabase migration.

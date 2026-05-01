## Goal

Fix the silent 1000-row cap in the Analytics → Attendance tab so the engagement distribution and campus-filtered counts are accurate at any org size.

## Changes

### 1. Database migration — add two SECURITY DEFINER RPCs

**`get_org_engagement_distribution(p_org_id uuid, p_campus_id uuid default null)`**
- Returns `(engagement_level text, count bigint)` rows.
- Server-side `GROUP BY engagement_level` on `contact_engagement_scores`, joined to `contacts` when `p_campus_id` is provided.
- Internal access check: caller must be a member of `p_org_id` via `organization_members` (or a system admin).

**`get_org_checkin_counts(p_org_id uuid, p_campus_id uuid default null, p_week_start timestamptz, p_month_start timestamptz)`**
- Returns a single row `(checkins_week bigint, checkins_month bigint)`.
- Two `COUNT(*)` aggregates over `pco_checkins` filtered by `organization_id`, `checked_in_at >=` thresholds, and (optionally) `contact_id IN (SELECT id FROM contacts WHERE campus_id = p_campus_id)`.
- Same access check as above.

Both functions: `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`, granted to `authenticated`.

### 2. Update `src/hooks/useCheckinData.tsx`

Rewrite `useOrgCheckinStats` to:
- Compute `weekAgo` / `monthAgo` as today.
- Call `supabase.rpc('get_org_checkin_counts', { p_org_id, p_campus_id, p_week_start, p_month_start })` for the two counts.
- Call `supabase.rpc('get_org_engagement_distribution', { p_org_id, p_campus_id })` and reduce rows into the `{ level: count }` map the UI already expects.
- Drop the old `.select('id', { count: 'exact', head: true })` queries and the campus contact-ID prefetch (the prefetch itself was capped at 1000).

No changes needed in `AttendanceSection.tsx` — the returned shape stays identical:
```
{ checkinsThisWeek, checkinsThisMonth, engagementDistribution }
```

## Why this fixes it

- Aggregation happens in Postgres, so PostgREST's 1000-row response cap never applies.
- Counts are exact regardless of how many contacts/check-ins exist.
- One round-trip per metric instead of fetching rows and counting in JS.
- Campus filter is applied inside the SQL, so large campuses no longer silently drop contacts past row 1000.

## Out of scope

- Wiring the page-level DateRangeFilter into Attendance (still uses fixed 7/30 day windows). Happy to do it next as a separate change.
- Other analytics tabs (Overview/Flows/Team/People) — only Attendance had the bug you flagged.

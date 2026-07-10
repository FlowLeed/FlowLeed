Add more signal to the audit by tapping data we already sync but don't yet surface. Below is what I'd add, grouped by section, plus a new "Guest & New Family Follow-up" section since that's the #1 request.

## New section: Guest & New Family Follow-up

Uses `flow_moments` (first-time guest / new family moments), `pco_checkins`, and `contact_interactions`.

- **First-time guests (last 30 days)** — count of contacts with a first-visit moment or first check-in in last 30 days.
- **New families (last 60 days)** — households where any member had a first check-in in the last 60 days (grouped by `pc_household_id`).
- **Guests with no follow-up** — first-time guests from the last 30 days who have zero `contact_interactions` since their visit. High severity.
- **Second-time attenders not yet in a flow** — people with 2+ check-ins in last 60 days but no active `pipeline_contacts` row.

Section score = % of recent guests who received at least one follow-up interaction.

## Additions to "At-Risk People"

- **No check-in in the last 30 days** — previously regular attenders (≥4 weeks in last 12) with no check-in for 30+ days. Earlier warning than the existing 60-day finding.
- **Missed 2+ Sundays in a row** — contacts whose last check-in was 14–29 days ago after a regular pattern.
- **Regulars whose small-group attendance stopped** — active in Sunday check-ins but no group attendance in 45+ days.
- **Prayer requests with no follow-up** — open `contact_prayer_requests` older than 14 days with no interaction since.

## Additions to "Volunteer & Leader Health"

- **Leaders whose own engagement is dropping** — leaders/co-leaders whose engagement level is `at_risk` or `inactive`.
- **Groups whose leader hasn't checked in recently** — leader with no check-in in 30 days.
- **New leaders in last 90 days** — informational count (helps celebrate + focus onboarding care).

## Additions to "Groups Health"

- **Groups with declining attendance** — average attendees per meeting dropped >30% comparing last 30 days vs prior 30 days.
- **Groups with no new members in 90 days** — signals stagnation.
- **Pending group signup requests** — open `group_signup_requests` older than 7 days (leadership responsiveness).
- **Groups with attendance but no meetings logged** — data hygiene issue that skews reports.

## What we already surface (for reference)

At-Risk: no check-in 60d, drifting, slowing.
Volunteers: leaders without care, overloaded leaders.
Groups: dormant, over-capacity, no co-leader.

## Technical notes

- All new metrics come from tables already queried or trivially joinable: `flow_moments`, `flow_moment_types`, `pco_checkins`, `group_attendance`, `contact_prayer_requests`, `pipeline_contacts`, `group_signup_requests`, `contacts.pc_household_id`.
- Extend the paginated `fetchAll` block in `supabase/functions/run-church-audit/index.ts` with the new tables (guarded date windows: 30/60/90 day slices).
- Add a fourth section key `guests` to `church_health_reports.section_scores` and update `AuditReportPage.tsx` to render a `SectionCard` with a `Users2`/`UserPlus` icon between the header and At-Risk.
- Overall score becomes average of 4 section scores instead of 3.
- Each new finding follows the existing `{ section, key, title, description, severity, metric_value, metric_label, contact_ids, sort_order }` shape so `CohortDialog` + "Add to flow" keep working with no UI changes.
- No schema migration needed; `section_scores`/`metrics` are already `jsonb`.

## Open questions

1. Do you want the new "Guest & New Family Follow-up" as its own section, or folded into At-Risk?
2. Should "No check-in 30d" replace the 60d finding or sit alongside it as an earlier warning?
3. Any additions above you'd rather skip for v1?

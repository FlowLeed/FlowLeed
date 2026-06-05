
## Goal

Surface *why* someone is thriving, slowing down, or drifting — not just a score. Each contact gets a set of **Active markers** (positive signals) and **Risk markers** (concerning trends). Markers are computed from data we already sync, so leaders can act before someone disappears.

## Concept: Markers

A **marker** is a small, named fact about a person derived from the last 90 days of activity. Each marker has:

- a key (e.g. `attending_group_66`)
- a category (Attendance, Group, Serving, Event, Family, Giving)
- a polarity (positive / neutral / negative)
- a short label ("Attending group 66%+")
- a tooltip explaining the underlying numbers ("Attended 8 of last 12 group meetings")

A contact's **engagement signal** (Thriving / Steady / Slowing / Drifting) is derived from the mix of positive vs negative markers and recency, replacing the current single number as the *primary* read.

## Marker catalog (phase 1 — data we already have)

Attendance (from `pco_checkins`):
- Attended Sunday recently (last 14 days)
- Attended Sunday 3+ of last 4 weeks → "Consistent attender"
- Missed last 3 Sundays after prior regular attendance → **Slowing down**
- Missed last 6+ Sundays → **Drifting**
- Kids checked in (last 30 days) — derived from household check-ins
- First-time / second-time guest (from `checkin_kind = 'guest'`)

Group life (from `group_members`, `group_attendance`, `group_meetings`):
- In a group
- Attending group 66%+ (last 8 meetings)
- Attending group 33–66%
- Attending group <33% → negative
- Hasn't attended group in 30+ days → negative

Serving (from `pco_checkins.checkin_kind = 'volunteer'`):
- Served in last 30 days
- Serves regularly (3+ times / 90 days)
- Stopped serving (served before, nothing in 60 days) → negative

Flow / journey (from `flow_moments`, `pipeline_contacts`):
- Attended open house / class / event — when a matching flow moment is logged
- In an active flow (Connect, Next Steps, etc.)
- Stuck in stage 30+ days → neutral/negative

Online (from `church_online_events`):
- Watched online recently
- Submitted prayer request / salvation moment

## Phase 2 markers (need new data sources — flagged, not built yet)

- Giving in last 90 days / stopped giving — requires PCO Giving sync (not connected)
- Scheduled to serve — requires PCO Services teams sync
- Registered for event / attended event — requires PCO Registrations sync

These appear in the catalog UI as "Connect Planning Center [Giving / Services / Registrations] to enable" so the user sees the full picture and what's missing.

## Signal level (replaces "engagement level" wording on Contacts page)

| Level | Meaning | Rule of thumb |
|---|---|---|
| Thriving | Multiple positive markers across categories | ≥3 positives, 0 negatives, attended within 14d |
| Steady | Showing up, low risk | ≥1 positive, ≤1 negative |
| Slowing | Early warning | Recent drop vs prior 90d baseline OR 1 strong negative |
| Drifting | Likely disconnecting | No attendance 6+ weeks OR ≥2 negatives, was previously active |
| New | <30 days history | — |

Signal is colored chip on the Contacts row, same place as today's engagement badge.

## UI changes

### 1. Contacts page (`/contacts`)
- Replace the current "Engagement" column chip with a **Signal chip** (Thriving / Steady / Slowing / Drifting / New).
- Hovering the chip shows the top 3 markers ("Why").
- New filter: **Signal** (multi-select) — alongside existing filters. Keep "Engagement level" filter as alias for back-compat or fold it into Signal.
- New filter: **Has marker** — pick any marker from the catalog (e.g. show me everyone "Stopped serving").
- Sort by "Most at risk" (Drifting → Slowing → Steady).

### 2. Contact detail page
- New **"Active markers"** card listing all positive markers as green pills, negatives as amber/red pills, each with the explanatory tooltip and the source date/number.
- Small "Why this signal" panel above the existing engagement section explaining the level in plain English ("Attended 1 of last 6 Sundays; was attending weekly through March.").

### 3. New page `/signals` (markers catalog)
- Lists every marker, what data drives it, current count of contacts matching, and which integrations enable it.
- Clicking a marker → filtered Contacts page showing those people.
- Phase 2 markers shown as locked rows with "Connect [integration]" CTA.

## Technical sketch

- New table `contact_markers` (contact_id, organization_id, marker_key, polarity, value_numeric, value_text, computed_at). One row per active marker per contact. Replaced on each recompute.
- New view / RPC `get_contact_signal(contact_id)` returning `{ signal, markers[] }` for the detail page.
- New RPC `list_contacts_with_signals(org_id, filters)` for the Contacts page so we don't N+1 marker queries from the client (current `useEngagementScore` already does one query per row; we'll fold it in).
- Recompute job: extend the existing engagement score pg_cron job to also recompute markers (same data, one pass). Recompute on demand when a check-in / group attendance / flow moment is inserted (trigger queues contact for refresh).
- Marker definitions live in a single SQL function so polarity/thresholds are tunable in one place.

```text
pco_checkins ─┐
group_attendance ─┼─► recompute_contact_markers(contact) ──► contact_markers
flow_moments ─┤                                         └──► contact_engagement_scores (updated)
church_online_events ─┘
```

## Out of scope (this plan)

- Notifications when someone flips to Drifting (good follow-up).
- Editing marker thresholds in the UI (start with sensible defaults in SQL).
- Phase 2 integrations (Giving / Services / Registrations sync) — plan covers showing the gap, not building the syncs.

## Open questions

1. Should the Contacts page **default-sort** by "Most at risk" so leaders see Drifting first, or stay alphabetical with a sort toggle?
2. For "Slowing" detection, compare against the contact's own prior 90d baseline (personalized) or a fixed threshold (simpler)? Personalized catches John Carter quietly burning out; fixed is easier to explain.
3. Should family/household markers (e.g. "Kids checked in") attach to both parents automatically, or only to the household primary?

## What's going on (verified against your data)

For your org `3fae9226…6406f`:

- Total contacts: **16,942**
- Scored in Heartbeat: **7,798**
- Unscored: **9,144**

The scoring engine (`calculate_engagement_scores`) only writes a row to `contact_engagement_scores` for a contact that has **at least one check-in** — either directly, through a household member, or through a family member. Of the unscored 9,144:

- **9,141** came from Planning Center (only 3 are manual)
- **8,490** have no `pc_household_id` (so household-borrowed check-ins can't lift them)
- **8,406** haven't been re-synced in 30+ days (`last_synced_at` is stale or null)
- 309 have no `campus_id`

Breakdown of how the 7,798 get scored today:
- 5,766 have their own check-in
- ~2,045 inherit check-ins from a household member
- the rest from `contact_family_members`

So the 9,144 are essentially **PCO people we've ingested who have never been checked into any synced service/event, and aren't tied to a household that has**. Classic culprits: adults at churches that only check in kids, legacy PCO profiles, archived/inactive people that PCO still returns, and people pulled in via a List but never seen at a service.

## What I'd like to ship

A small, honest fix in two parts. Both are presentation-only — no scoring math changes.

### 1. Reconciliation on the Heartbeat card

Add an **"Unscored"** row at the bottom of the Heartbeat list (rendered subtler than the 5 engagement levels — muted text, no sparkline, no "Follow up" button) showing `totalContacts - scoredTotal`. The header total switches from "7,798 people" to "16,942 people" so it matches the dashboard's Total People card. The "X scored of Y" relationship becomes self-evident.

- Click row → navigates to `/contacts?engagementLevel=unscored` so leaders can see exactly who's in the bucket.
- Tooltip explains: *"In PCO but no check-ins yet — likely adults who don't check in, archived profiles, or list-only contacts."*

### 2. "Unscored" filter on the Contacts page

`ContactFilters` / `ContactsTable` already accept `engagementLevel`. Add an `unscored` option that resolves to `contacts.id NOT IN (SELECT contact_id FROM contact_engagement_scores WHERE organization_id = …)`. This lets the user actually investigate the cohort (sort by `last_synced_at`, by campus, by household, etc.) and decide whether to archive, re-sync, or enroll them in a re-engagement flow.

## Technical notes

- `HeartbeatCard.tsx`: pull `totalContacts` from `useOverviewMetrics` (already used elsewhere) or add it to `useOrgCheckinStats`. Compute `unscoredCount = totalContacts - sum(LEVELS counts)`. Render below the 5 LEVELS rows with a divider; reuse existing row markup but skip Sparkline/DeltaBadge/Follow-up.
- Contacts filter: extend the engagement level enum in `ContactFilters.tsx` + the query in `useContacts.tsx` to handle `unscored` via an anti-join on `contact_engagement_scores`.
- No migrations, no edge function changes, no edits to `calculate_engagement_scores`.

## Out of scope (call out, don't do)

- Re-tuning the scoring formula so more people get a score.
- Auto-archiving PCO contacts with no check-ins.
- A separate "stale sync" badge — `last_synced_at` already exists if you want it later.

Sound good? If yes, I'll implement parts 1 and 2.

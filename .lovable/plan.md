
# Sync Planning Center Groups → FlowLeed

Goal: pull every PCO Group (and its members + meetings + attendance) into FlowLeed, surface a person's groups on their profile, and feed group attendance into the engagement score.

The `groups`, `group_members`, `group_meetings`, and `group_attendance` tables already have the right shape (`pco_group_id`, `pco_membership_id`, native fields). No schema rewrite — additive only.

---

## Phase 1 — Schema additions (minimal)

`groups`:
- `pco_group_type_id text` — for filtering/grouping
- `pco_group_type_name text`
- `pco_location_id text`
- `member_count integer default 0`
- `last_synced_at timestamptz`
- `archived_at timestamptz` (so we can soft-delete groups removed in PCO)

`group_members`:
- `pco_person_id text` (index) — match path when no contact yet
- `synced_at timestamptz`

`group_meetings`:
- `pco_event_id text unique per group`
- `attendance_submitted boolean default false`

`group_attendance`:
- `pco_attendance_id text` — unique per meeting
- `pc_person_id text` — for unmatched contacts

Plus indexes on every `pco_*_id` for upsert performance.

---

## Phase 2 — Sync edge functions

Follow the existing PCO sync architecture (chunked, queued, rate-limited per memory `pco-rate-limiting-protection`).

New functions in `supabase/functions/`:

1. **`pco-sync-groups`** — orchestrator. Paginates `/groups/v2/groups?include=group_type,location` → upsert into `groups` by `pco_group_id`. Marks missing groups `archived_at = now()`.
2. **`pco-sync-group-members`** — per group, paginates `/groups/v2/groups/{id}/memberships?include=person` → upsert `group_members` by `pco_membership_id`. Resolves `contact_id` by `pc_person_id`. Updates `member_count`.
3. **`pco-sync-group-events`** — per group, paginates `/groups/v2/groups/{id}/events` (or `/events` with filter) → upsert `group_meetings` by `pco_event_id`.
4. **`pco-sync-group-attendance`** — per event, paginates `/groups/v2/events/{id}/attendances?include=person` → upsert `group_attendance` with `status='present'|'absent'`, `checked_in_at = event.starts_at`. Sets `last_attended_at` + `attendance_count` via existing trigger.

All four reuse the shared PCO auth helper, 350 ms throttle, exponential backoff, and the `pco_sync_queue` pattern.

### Scheduling

- Add to existing PCO sync config (`pco_sync_frequency`): groups follow the same cadence (`daily` / `twice_daily` / `manual`) — no new cadences (memory rule).
- Initial backfill triggered once on first sync; thereafter incremental via `?where[updated_at][gte]=last_synced_at`.
- New `pg_cron` job calls `pco-sync-groups` which fans out to the other three.

### Onboarding flag

Extend `organizations.onboarding_progress` with `pco_groups_synced`. Set true after first successful run.

---

## Phase 3 — Person profile: "Groups" section

New component `ContactGroupsCard.tsx` on `ContactDetailPage`:
- Query: groups where `group_members.contact_id = contact.id` (or `pc_person_id` match) and `status='active'`.
- For each group show: avatar/name, role badge (Leader / Co-Leader / Host / Member), join date, attendance count, last attended (relative), and a small attendance sparkline (last 12 weeks from `group_attendance`).
- Empty state: "Not in any groups yet."
- Click → `/groups/{id}`.

Also: a "Group attendance" row in the existing contact timeline, sourced from `group_attendance` joined to `group_meetings` + `groups`.

---

## Phase 4 — Engagement score integration

`calculate_engagement_scores` already reads `group_attendance` (status='present') into `combined_attendance` and `leadership` already considers `group_members.role IN ('leader','co_leader','host')`. Once Phase 2 populates these tables for every org, scoring picks it up automatically.

Tweaks worth shipping with this phase:
- Add small "group consistency" bonus: if a contact attends ≥ 60% of their group's last 8 meetings, +5 to the Frequency component (capped at the existing 35).
- Treat `group_members.role = 'leader' | 'co_leader' | 'host'` as floor `active` (already in place).
- Recompute scores at the end of `pco-sync-group-attendance` for affected orgs.

---

## Phase 5 — Groups page integration

`GroupsPage` already lists native groups. After sync:
- Show a "Synced from Planning Center" badge on PCO-sourced groups (where `pco_group_id is not null`).
- Lock the destructive fields on synced groups (name, members, meetings) — edits route the user to PCO with a tooltip "Managed in Planning Center". Local-only fields stay editable: `description`, `image_url`, `tags`, `visibility`, `allow_public_signup`, `public_signup_token`.
- Filter chip: "All / Native / Planning Center".
- Group detail page: new "Attendance" tab driven by `group_meetings` + `group_attendance` (already structurally supported).

---

## Phase 6 — What else we should add (proposed)

1. **Group-type mapping**: small admin screen mapping PCO group types → tags / categories in FlowLeed, so the public directory can filter by category without re-tagging.
2. **Leader → user linking**: when a PCO group leader's email matches a FlowLeed `profiles.email`, auto-assign `groups.leader_user_id`. Surface unmatched leaders in an admin "Needs linking" panel.
3. **Auto-enroll in flows from group activity**: e.g. first-time group visitor → "New Group Member" flow. Configurable per group type in a future iteration.
4. **Attendance-based moments**: detect "Joined a small group" via new `group_members` insert → fire `flow_moments` (`Small Group Joined` already seeded by `seed_default_moment_types`).
5. **Drop-off detection**: contact attended 4+ weeks then missed 3 in a row → notification to group leader + tag on contact profile.
6. **Public directory parity**: surface `member_count` and "spots left" using existing `capacity` field, now that headcount is real.
7. **Webhook path (later)**: PCO Groups doesn't expose first-class webhooks for attendance, so polling stays. Document this in the integrations memory.
8. **Sync health card** on `/admin/integrations`: last_synced_at per entity (groups / memberships / events / attendances) + retry button per stage.

---

## Out of scope (call out)

- Creating/updating groups in PCO from FlowLeed (one-way sync only).
- Real-time check-in writeback into PCO.
- Historical attendance backfill beyond 12 months (configurable later).

---

## File map

- New SQL migration: additive columns + indexes on the 4 group tables; onboarding flag.
- New edge fns: `pco-sync-groups`, `pco-sync-group-members`, `pco-sync-group-events`, `pco-sync-group-attendance`.
- New cron entry calling `pco-sync-groups`.
- New frontend: `ContactGroupsCard.tsx`, "PCO" badge + lock UI in `GroupsPage` / `GroupDetailPage`, Attendance tab.
- Modified: `calculate_engagement_scores` (group consistency bonus), contact timeline source list, group edit dialogs (read-only fields for synced groups).
- Untouched: existing native groups data path.

---

## Rollout

1. Ship Phase 1 + 2 dark — first org test (internal), verify counts vs PCO.
2. Flip Phase 3 + 5 UI per org behind onboarding flag.
3. Recalculate engagement scores per org once attendance lands (Phase 4).
4. Iterate on Phase 6 items based on what surfaces first in real data.

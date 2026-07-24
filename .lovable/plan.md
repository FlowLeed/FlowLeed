# Settings → Groups

New admin-only page at `/settings/groups` with four sections.

## 1. Custom Group Types
Per-org, editable list replacing the hardcoded 4 options.

**DB:** `group_type_definitions` (org_id, key, label, icon, color, sort_order, is_active, is_system). Seed each org with the current 4 (small_group, serving_team, class, ministry) marked `is_system=true` (can disable/rename but not delete). RLS: org members read; admins write.

**UI:** sortable list with inline edit; add/edit dialog with label, icon picker (lucide), color, active toggle. Delete disabled for system rows; disable instead.

**Wire-in:** `CreateGroupDialog`, `EditGroupDialog`, `GroupCard`, `GroupDirectoryPage` filter chips — replace the hardcoded 4-option `<Select>` with types fetched via a new `useGroupTypes(orgId)` hook. Existing `groups.group_type` values keep working (matched by `key`).

## 2. Group Defaults
Per-org defaults applied when creating a new group. Stored in a new `group_settings` row (org_id PK) — one row per org, upserted.

Fields: default meeting frequency (weekly/biweekly/monthly), default visibility (public/private), default `allow_public_signup` toggle, default capacity.

`CreateGroupDialog` reads these to prefill.

## 3. Public Directory Settings
Same `group_settings` row.

Fields:
- `directory_enabled` (bool) — when off, `/:slug/groups` returns 404-style empty state.
- `directory_hero_title` (text, default "Find Your Community")
- `directory_hero_subtitle` (text)
- `directory_show_meeting_time` / `directory_show_location` / `directory_show_capacity` (bools)

`GroupDirectoryPage` reads these; if disabled → friendly message. Hero copy driven by fields.

## 4. Lifecycle Automation
Same `group_settings` row.

Fields:
- `auto_inactive_weeks` (int, nullable) — nightly cron marks groups `status='inactive'` when no attendance recorded in N weeks. Null disables.
- `attendance_reminder_enabled` (bool) + `attendance_reminder_day` (0-6) — weekly reminder notification/email to group leaders on that day if attendance not logged for the most recent meeting.

**Cron:** two pg_cron jobs calling new edge functions `groups-lifecycle-check` (daily 3 AM UTC) and `groups-attendance-reminders` (daily 2 PM UTC, filters by day-of-week per org). Both scoped by `group_settings`.

## Technical notes
- New route in `App.tsx`: `/settings/groups` gated by `useIsOrgAdmin`.
- Add "Groups" tab/link in existing settings navigation.
- Migration order: create `group_type_definitions` + `group_settings` with GRANTs + RLS, seed both for existing orgs, then wire UI.
- No breaking changes to `groups` table itself.

## Out of scope
- Renaming existing `groups.group_type` values in bulk (kept as-is; new types add to the list).
- Per-campus group settings.

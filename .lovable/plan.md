## Goal

Make daily group-attendance sync reliable so meetings like Promise & Pour's June 1 session populate without manual intervention, and backfill The Promise Center now.

## Root cause

`supabase/functions/pco-groups-auto-sync/index.ts` decides whether an org is "due" using only `metadata.last_groups_sync_at`, which is set the moment `pco-sync-groups` finishes. The follow-up `pco-sync-group-attendance` paginates through groups via `groups_attendance_cursor_idx` in batches of 25. If the attendance loop doesn't reach the end of the group list in one orchestration run (timeout, error, or just many groups), the cursor is left mid-list AND the org is marked "synced today" — so the next 24h of cron runs skip the org, leaving past-week attendance unsynced.

For Promise Center: cursor stuck at 125/140, `last_groups_attendance_sync_at` missing, but `last_groups_sync_at` set today → org skipped for 24h, and Promise & Pour (group index ~72) never gets a second pass when PCO attendance is actually entered.

## Changes

### 1. Fix the cadence gate in `pco-groups-auto-sync/index.ts`

Treat an org as "due" when EITHER (a) cadence elapsed since `last_groups_sync_at` OR (b) attendance pipeline hasn't completed since the last groups sync (i.e., `groups_attendance_cursor_idx` is still set, or `last_groups_attendance_sync_at` < `last_groups_sync_at`). This guarantees the attendance loop keeps getting kicked until its cursor fully drains.

### 2. Make the attendance orchestration loop more resilient

In the same orchestrator, raise `MAX_ROUNDS` from 15 → 40 for the attendance phase and, after the loop, if `hasMore` is still true, log a clear warning so it's visible in edge function logs.

### 3. Re-fetch attendance for past meetings even when no new meetings were upserted

In `pco-sync-group-attendance/index.ts`, the per-group attendance fetch is currently driven by `meetingRows` (events just returned from PCO). That's fine because PCO returns past events in the 90-day lookback every run, so they'll be re-processed. No change needed here — confirming behavior.

### 4. Backfill The Promise Center now

After deploy, manually invoke `pco-sync-group-attendance` for integration `9a1f2c7e-f256-4a39-9ec3-7a1ae5db23cf` repeatedly until `hasMore=false`, then verify `group_attendance` rows appear for meeting `08bf7a80-6bf5-4548-8ae3-8df1351ee155` (Promise & Pour, June 1).

### 5. Save memory

Update `mem://integrations/pco-groups-sync` to record that the orchestrator's cadence gate must consider attendance-cursor completion, not just groups-sync completion.

## Out of scope

- No schema changes.
- No UI changes (no per-group "Resync" button this round — can add later if still needed).
- No change to `pco-sync-groups` itself.

## Verification

- Edge logs for `pco-groups-auto-sync` show attendance loop running to `hasMore=false` for Promise Center.
- `integrations.metadata` for `9a1f2c7e…` has `last_groups_attendance_sync_at` set and `groups_attendance_cursor_idx` cleared.
- `SELECT count(*) FROM group_attendance WHERE group_meeting_id='08bf7a80-6bf5-4548-8ae3-8df1351ee155'` returns 6 present + 3 absent (matches PCO's 6/9).

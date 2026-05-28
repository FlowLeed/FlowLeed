## Goal

Currently the Meetings tab on the group detail page lists meetings but never shows actual attendance — even though `group_attendance` is already populated (PCO sync + manual "Take Attendance"). Add attendance visibility for admins.

## Changes (single file: `src/pages/GroupDetailPage.tsx`)

### 1. Fetch attendance counts per meeting
Add one query that pulls aggregate attendance for all meetings in this group in a single round-trip:

```ts
supabase
  .from("group_attendance")
  .select("group_meeting_id, status")
  .in("group_meeting_id", meetings.map(m => m.id))
```

Reduce client-side into `{ [meetingId]: { present, absent, total } }`.

### 2. Show per-meeting attendance on each meeting card
Under the meeting title/date line, render:
- `12 / 18 present` (with subtle bar or percent badge)
- If `attendance_submitted` is true → green "Submitted" badge; else muted "Not recorded"
- Keep the existing "Take Attendance" button

### 3. Add an Attendance summary card above the meetings list
A compact stats strip for the last 8 completed meetings:
- **Avg attendance**: X / Y (Z%)
- **Last meeting**: relative date + present count
- **Trend**: tiny sparkline (8 dots/bars) of attendance % per meeting, oldest → newest

Uses the same query result — no extra fetch.

### 4. Minor: Members tab "meetings attended" already shows from `attendance_count`. Leave as-is.

## Out of scope
- No DB migrations (data already exists)
- No changes to PCO sync, AI context, or `TakeAttendanceDialog`
- No new routes or hooks

## Technical notes
- Query is gated on `meetings.length > 0`
- Invalidate `["group-attendance-summary", groupId]` when `TakeAttendanceDialog` saves (piggyback on existing `["attendance"]` invalidation by adding the new key)
- ~80 lines added to `GroupDetailPage.tsx`

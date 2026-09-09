# Fix the failed Planning Center sync

## What actually happened

Two separate failures, both confirmed in today's logs (Sep 9, 17:15 UTC):

1. **The Promise Center full people sync stopped with "too many requests" (HTTP 429).**
   Planning Center throttled us, and the people sync has no waiting/retry logic, so it gave up
   immediately instead of pausing and continuing. The check-in sync for the same church was running
   at the same moment (it was on page ~150 of check-ins), and a second church in the account
   (The Connect Church) is connected to the same Planning Center account (134069), so three jobs
   were pulling from one rate limit at once.
   Result: Promise Center still shows 17,999 people last touched Aug 20 and has never completed a
   full sync since the account was corrected.

2. **One New Vintage Church list no longer exists in Planning Center (HTTP 404).**
   The saved list "Church Facility Flow" (Planning Center list 4576130) was last synced Jul 21 and
   now returns "not found", so every automatic run logs an error for it.

## Fix

**A. Survive throttling (main fix)**
- Add the same retry-with-backoff wrapper the check-in sync already uses to every Planning Center
  request in the people/list sync: on 429, read `Retry-After`, wait, retry up to a few times; on
  5xx, retry with growing delays.
- Add a small pause between pages so we stay under the rate limit instead of racing into it.
- If retries are exhausted, save progress and mark the job "paused, will continue" instead of
  failing outright.

**B. Stop jobs from competing**
- Skip starting a people sync for a Planning Center account that already has a check-in sync in
  progress, and stagger churches that share the same Planning Center account so they don't run in
  the same minute.

**C. Handle lists that were deleted in Planning Center**
- On a 404 for a saved list, mark that mapping inactive and record "list no longer exists in
  Planning Center" instead of throwing, and surface that on the Integrations page so it can be
  removed or re-picked.

**D. Then re-run the Promise Center backfill**
- After the above is in place, kick off a full people sync plus a check-in backfill for
  The Promise Center and verify counts and Pastoral Context fields on a sample person.

## Technical notes

- `supabase/functions/planning-center-lists/index.ts` has no 429 handling: the four fetch loops
  (`fetchPlanningCenterLists`, `syncAllPeopleFromPCO` ~line 409, `syncSingleList` ~line 706,
  `triggerAutoFullPeopleSync` ~line 1198) only special-case 401 and otherwise
  `throw new Error("PC API error: " + status)`.
- Reuse the pattern in `supabase/functions/pco-sync-checkins/index.ts` (lines ~20-25) — extract it
  into a shared helper and use it in both functions.
- Concurrency guard: `integrations.metadata.checkin_sync_cursor` / `checkin_sync_started_at`
  already indicate an in-flight check-in run; use it as the lock signal.
- Deleted-list handling: set `integration_list_mappings.auto_sync = false` and store the reason,
  keyed on the 404 from `/lists/{id}/list_results`.
- No schema changes required.

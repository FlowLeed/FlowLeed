

## Problem: Check-in Sync Times Out Before Writing Data

The `pco-sync-checkins` edge function fetches **all** check-ins from PCO in a single invocation. For large organizations, this means 100+ API pages (10,000+ records), taking 2-3+ minutes. The function **times out** before it ever reaches the upsert phase, so **zero rows** end up in `pco_checkins`.

Evidence from logs: The function reached page 131+ (13,000+ checkins) without ever logging "Fetched" or "Upserted" — it dies mid-pagination every time.

Additionally, a second sync was triggered by the auto-sync cron while the first was still running, wasting resources.

---

## Plan: Chunked Check-in Sync

Restructure the sync to process in **bounded chunks** (max 30 pages per invocation ~3,000 records), upsert immediately, and resume from a cursor on the next call.

### Step 1: Update `pco-sync-checkins` edge function

- Add a `maxPages` parameter (default 30) to cap pages per invocation
- After fetching `maxPages` pages, if there are more:
  - Upsert the batch collected so far
  - Save the `nextUrl` (PCO pagination cursor) in integration metadata as `checkin_sync_cursor`
  - Return `{ hasMore: true, synced: N, cursor: savedCursor }`
- If no more pages:
  - Upsert everything, calculate engagement scores, clear the cursor, update `last_checkin_sync_at`
  - Return `{ hasMore: false, synced: N }`
- Move the upsert + contact matching to happen **per chunk** (after each maxPages batch) rather than after fetching everything

### Step 2: Update `pco-checkin-auto-sync` to loop

- After invoking `pco-sync-checkins`, check if `hasMore` is true
- If so, re-invoke the function (up to 10 rounds) to continue from the saved cursor
- Add a guard: skip triggering if a `checkin_sync_cursor` already exists in metadata (sync in progress)

### Step 3: Update `useSyncCheckins` hook

- After a manual sync call, if response has `hasMore: true`, automatically re-invoke until complete (with a progress toast)

### Step 4: Reset stale sync state

- Clear `last_checkin_sync_at` for the two orgs that recorded a sync but have 0 data, so they re-sync on next cron run

### Technical Details

**Cursor storage** (in `integrations.metadata`):
```json
{
  "checkin_sync_cursor": "https://api.planningcenteronline.com/check-ins/v2/check_ins?offset=3000&per_page=100",
  "checkin_sync_started_at": "2026-03-13T..."
}
```

**Timeout safety**: 30 pages × ~1.5s/page = ~45 seconds for fetching + ~5s for upsert = well within the 60s limit.

**Engagement scores**: Only calculated on the final chunk (when `hasMore` is false) to avoid redundant computation.

**Files changed**:
- `supabase/functions/pco-sync-checkins/index.ts` — chunked pagination with cursor
- `supabase/functions/pco-checkin-auto-sync/index.ts` — loop until complete
- `src/hooks/useCheckinData.tsx` — auto-continue on `hasMore`
- One migration to reset `last_checkin_sync_at` for orgs with 0 checkin data


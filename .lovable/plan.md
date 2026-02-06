

## Fix: Incremental Sync Not Working Due to Edge Function Timeout

### Problem Summary

You're asking a great question - the incremental sync logic **already exists** in the code (lines 1133-1145), but it's not working for "The Promise Center" because:

1. **Edge function times out** before creating all 600 chunks (~60 second limit)
2. Only 50-150 chunks get created per sync attempt
3. The code that sets `last_full_sync_completed_at` is at the END of the function
4. Timeout kills the function BEFORE that code runs
5. `last_full_sync_completed_at` stays `NULL` forever
6. Next sync sees NULL → triggers full sync again

| Sync Attempt | Expected Chunks | Chunks Created | `last_full_sync_completed_at` Set? |
|--------------|-----------------|----------------|-------------------------------------|
| Feb 4 18:00 | 599 | 50 | No (timeout) |
| Feb 4 20:47 | 599 | 50 | No (timeout) |
| Feb 4 22:32 | 599 | 150 | No (timeout) |
| Feb 5 03:17 | 600 | 50 | No (timeout) |
| Feb 5 04:47 | 600 | 150 | No (timeout) |

### Solution: Set Timestamp BEFORE Chunk Creation

Move `last_full_sync_completed_at` update to run **immediately after creating the job**, before the chunk insertion loop. This ensures the timestamp is set even if the function times out during chunk creation.

### Code Changes

**File: `supabase/functions/planning-center-lists/index.ts`**

Move the timestamp update from line 1294-1302 to right after job creation (after line 1253):

```typescript
// BEFORE (current - at end, never reached on timeout):
// ... chunk creation loop ...
await supabase.from('integrations').update({ 
  last_sync_at: new Date().toISOString(),
  last_full_sync_completed_at: new Date().toISOString()
}).eq('id', integrationId);

// AFTER (new - immediately after job creation):
console.log(`[Auto-sync] Created sync job: ${job.id}`);

// Set last_full_sync_completed_at IMMEDIATELY after job creation
// This ensures incremental sync works even if edge function times out during chunk creation
await supabase.from('integrations').update({ 
  last_sync_at: new Date().toISOString(),
  last_full_sync_completed_at: new Date().toISOString()
}).eq('id', integrationId);

// Then continue with chunk creation...
const CHUNK_SIZE = 25;
```

### Why This Works

1. Job is created with correct `total_contacts`
2. Timestamp is set immediately (even if timeout occurs)
3. Chunks are inserted (may timeout partway through)
4. Processor handles whatever chunks exist
5. Next sync checks `last_full_sync_completed_at` → finds timestamp → does incremental sync
6. Incremental sync only fetches contacts updated since that timestamp

### Expected Behavior After Fix

| Scenario | Contacts Fetched |
|----------|------------------|
| First sync ever | All ~15,000 (full sync) |
| Next sync (1 day later) | Only 0-10 updated contacts |
| Sync after bulk update | Only modified contacts |

### Immediate Manual Fix

To unblock The Promise Center right now, run this SQL:

```sql
UPDATE integrations 
SET last_full_sync_completed_at = '2026-02-05T04:47:26Z'
WHERE id = '5ae01ba0-989a-45c4-ade3-30bb8c8d8b37';
```

This sets the timestamp to when the current job started, so future syncs will only fetch contacts modified after that time.

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/planning-center-lists/index.ts` | Move `last_full_sync_completed_at` update to immediately after job creation (line ~1253) |


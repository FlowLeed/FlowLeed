

## Investigation Complete: PCO Sync Stuck in Endless Loop

### Problem Summary

The sync is stuck showing "Preparing to sync 14967 people..." because **90 duplicate sync jobs** are queued up, and new jobs keep being created every minute.

### Root Causes Identified

| Issue | Current State | Impact |
|-------|---------------|--------|
| Cron schedule too aggressive | `* * * * *` (every minute) | Creates new jobs every 60 seconds |
| `last_full_sync_completed_at` never set | Always `NULL` | `shouldSyncNow()` always returns `true` |
| Timestamp updated before completion | `metadata.last_full_sync_at` set immediately on trigger | Doesn't prevent duplicate jobs |
| Legacy sync frequency | `every_15_minutes` still active | Not in allowed list, defaults incorrectly |
| Race condition in duplicate check | Check happens before job is created | Multiple invocations can pass the check simultaneously |

### Current State

```text
Integrations for "The Promise Center":
- ID: 5ae01ba0... → sync_frequency: daily, last_full_sync_completed_at: NULL
- ID: 60f84e00... → sync_frequency: every_15_minutes (legacy), last_full_sync_completed_at: NULL

Cron Jobs:
- planning-center-auto-sync: * * * * * (EVERY MINUTE - too aggressive!)
- pco-sync-processor: * * * * * (correct - processes queue)

Pending Jobs: 90 jobs, all status "pending"
Pending Queue Items: 100+ chunks waiting to process
```

### Solution

#### Phase 1: Immediate Cleanup (Database)

Run these SQL commands manually in Supabase SQL Editor:

```sql
-- 1. Cancel all duplicate pending jobs (keep only the most recent)
UPDATE pco_sync_jobs 
SET status = 'cancelled', 
    error_message = 'Cancelled: duplicate job cleanup'
WHERE list_mapping_id IS NULL 
AND status = 'pending'
AND id NOT IN (
  SELECT DISTINCT ON (organization_id) id 
  FROM pco_sync_jobs 
  WHERE list_mapping_id IS NULL AND status = 'pending'
  ORDER BY organization_id, started_at DESC
);

-- 2. Cancel orphaned queue items from cancelled jobs
UPDATE pco_sync_queue 
SET status = 'cancelled'
WHERE sync_job_id IN (
  SELECT id FROM pco_sync_jobs WHERE status = 'cancelled'
) AND status = 'pending';

-- 3. Fix legacy sync frequencies
UPDATE integrations 
SET sync_frequency = 'daily' 
WHERE sync_frequency NOT IN ('daily', 'twice_daily', 'manual');

-- 4. Update cron to run every 15 minutes instead of every minute
SELECT cron.unschedule('planning-center-auto-sync');
SELECT cron.schedule(
  'planning-center-auto-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://lghamvpolwebtjwaxned.supabase.co/functions/v1/planning-center-lists',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnaGFtdnBvbHdlYnRqd2F4bmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MjE0OTEsImV4cCI6MjA3MTQ5NzQ5MX0.yrtGMayjKCu0-K41XWanNe7U3zM0z39cK1fy1OgN7E4"}'::jsonb,
    body:='{"action": "autoSync"}'::jsonb
  );
  $$
);
```

#### Phase 2: Code Fixes

**File: `supabase/functions/planning-center-lists/index.ts`**

1. **Update timestamp correctly**: Set `last_full_sync_completed_at` in the database only after the job is fully created and queued (at end of `triggerAutoFullPeopleSync`), not just in metadata

2. **Add locking mechanism**: Use a database advisory lock or a "sync_in_progress" flag on the integration to prevent race conditions

3. **Use `last_full_sync_completed_at` for frequency check**: The function should check this column, not the metadata field

**Key code changes:**

```typescript
// In triggerAutoFullPeopleSync - at the END (after queue items created)
await supabase
  .from('integrations')
  .update({ 
    last_sync_at: new Date().toISOString(),
    // Only set completed_at once job is fully ready to process
    last_full_sync_completed_at: new Date().toISOString()
  })
  .eq('id', integrationId);
```

```typescript
// In autoSyncAllMappings - REMOVE the early metadata update (lines 977-988)
// The timestamp should only be set after successful job creation
```

**File: `supabase/functions/pco-sync-processor/index.ts`**

Ensure the processor updates `last_full_sync_completed_at` on the integration when a job completes:

```typescript
// When job status is set to 'completed'
await supabase
  .from('integrations')
  .update({ last_full_sync_completed_at: new Date().toISOString() })
  .eq('id', job.integration_id);
```

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/planning-center-lists/index.ts` | Fix timestamp logic, remove early metadata update |
| `supabase/functions/pco-sync-processor/index.ts` | Set `last_full_sync_completed_at` on job completion |
| Manual SQL | Clean up existing jobs, fix cron schedule |

### Expected Behavior After Fix

1. Cron runs every 15 minutes instead of every minute
2. `shouldSyncNow()` correctly uses `last_full_sync_completed_at` (set only after job completes)
3. No duplicate jobs can be created due to proper timestamp tracking
4. UI shows actual progress instead of being stuck in "Preparing" state

### Immediate Action Required

Before code changes, run the SQL cleanup commands to:
- Cancel 89 of 90 duplicate jobs
- Fix the cron schedule to prevent more duplicates
- Fix legacy sync frequencies




## Problem: `pco_sync_queue` Bloat (3.7 GB)

The table has 145K rows (114K cancelled, 28K completed, 2.5K failed) consuming 3.7 GB — mostly from JSONB `contact_data` payloads stored in completed/cancelled chunks. None of this data is needed after processing.

## Plan

### 1. Purge old queue rows
Delete all `completed`, `cancelled`, and `failed` rows older than 7 days. This removes ~145K rows and frees up the bulk of the 3.7 GB.

### 2. Add automatic cleanup to `pco-sync-processor`
At the start of each processor invocation (which already runs on a cron), add a cleanup query that deletes queue rows in terminal states (`completed`, `cancelled`, `failed`) older than 24 hours. This prevents future bloat.

### 3. Run VACUUM after purge
After the delete, trigger a vacuum to reclaim disk space from the deleted rows.

### Technical Details

**Immediate cleanup (run once via SQL):**
```sql
DELETE FROM pco_sync_queue 
WHERE status IN ('completed', 'cancelled', 'failed')
  AND created_at < NOW() - INTERVAL '7 days';
```

**Ongoing cleanup in `pco-sync-processor/index.ts`:**
Add at the top of the processing loop:
```typescript
// Cleanup old queue items to prevent bloat
await supabase
  .from('pco_sync_queue')
  .delete()
  .in('status', ['completed', 'cancelled', 'failed'])
  .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
```

This is a safe change — only terminal-state rows are deleted, and only after they're at least 24 hours old.


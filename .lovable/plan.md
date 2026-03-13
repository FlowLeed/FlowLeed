

## Database Cleanup Plan

### Current State
| Table | Size | Rows | Status |
|-------|------|------|--------|
| `pco_sync_queue` | **3,671 MB** | 135,560 (all terminal) | Still bloated despite REINDEX |
| `cron.job_run_details` | **314 MB** | 433,219 | 7 months of history |
| `pco_sync_jobs` | **9 MB** | 25,866 (all terminal) | Moderate |

The `VACUUM FULL` via psql did not take effect — the table is still 3.6 GB. All 135,560 rows in `pco_sync_queue` are in terminal states (cancelled/completed/failed), so every single row can be deleted.

### Plan

**Step 1: Delete all rows from `pco_sync_queue`** (reclaims data pages)
```sql
-- All rows are terminal, safe to delete everything
DELETE FROM pco_sync_queue WHERE id IN (
  SELECT id FROM pco_sync_queue LIMIT 50000
);
-- Repeat until 0 rows affected, then:
TRUNCATE pco_sync_queue;
```
Since every row is terminal, `TRUNCATE` is the fastest option — it releases all pages immediately without needing `VACUUM FULL`. Will use `TRUNCATE` if possible, otherwise batch delete.

**Step 2: Purge old cron history**
```sql
DELETE FROM cron.job_run_details WHERE end_time < NOW() - INTERVAL '7 days';
```

**Step 3: Clean terminal `pco_sync_jobs`** (keep last 7 days)
```sql
DELETE FROM pco_sync_jobs 
WHERE status IN ('completed', 'cancelled', 'failed') 
AND started_at < NOW() - INTERVAL '7 days';
```

**Step 4: Add scheduled cron cleanup** for `cron.job_run_details` to prevent regrowth — create a pg_cron job:
```sql
SELECT cron.schedule(
  'cleanup-cron-history',
  '0 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < NOW() - INTERVAL '7 days'$$
);
```

### Expected Result
~3.9 GB reclaimed across the three tables. The existing edge function cleanup (added earlier) handles `pco_sync_queue` and `pco_sync_jobs` going forward; the new cron job handles `cron.job_run_details`.


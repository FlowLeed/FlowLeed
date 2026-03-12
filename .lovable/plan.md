

## Add Automatic Cleanup for Old `pco_sync_jobs` Records

### What
Add a cleanup step in `supabase/functions/pco-sync-processor/index.ts` to delete `pco_sync_jobs` records in terminal states (`completed`, `failed`, `cancelled`) older than 30 days. This mirrors the existing queue cleanup pattern already in the file (lines 69-78).

### How
Insert a new cleanup block right after the existing `pco_sync_queue` cleanup (~line 82), deleting from `pco_sync_jobs` where status is terminal and `started_at` is older than 30 days:

```typescript
// === CLEANUP OLD TERMINAL SYNC JOBS (prevent table bloat) ===
try {
  const jobsCleanupCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: deletedJobsCount } = await supabase
    .from('pco_sync_jobs')
    .delete({ count: 'exact' })
    .in('status', ['completed', 'cancelled', 'failed'])
    .lt('started_at', jobsCleanupCutoff);
  if (deletedJobsCount && deletedJobsCount > 0) {
    console.log(`🧹 Cleaned up ${deletedJobsCount} old sync jobs (>30d, terminal state)`);
  }
} catch (cleanupError) {
  console.warn('⚠️ Jobs cleanup failed (non-fatal):', cleanupError);
}
```

Single file change, follows the exact same pattern as the existing queue cleanup.


-- Cancel ALL stuck sync jobs older than 2 hours (including those with pending queue items)
UPDATE pco_sync_jobs
SET
  status = 'cancelled',
  completed_at = now(),
  error_message = 'Auto-cancelled: job stalled for over 2 hours'
WHERE status IN ('pending', 'processing')
AND started_at < now() - interval '2 hours';

-- Cancel their pending queue items to clean up
UPDATE pco_sync_queue
SET status = 'cancelled'
WHERE sync_job_id IN (
  SELECT id FROM pco_sync_jobs
  WHERE error_message = 'Auto-cancelled: job stalled for over 2 hours'
)
AND status IN ('pending', 'processing', 'retrying');
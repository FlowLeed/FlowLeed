-- One-time cleanup: Cancel zombie sync jobs older than 1 hour with no pending work
UPDATE pco_sync_jobs 
SET 
  status = CASE 
    WHEN EXISTS (
      SELECT 1 FROM pco_sync_queue 
      WHERE sync_job_id = pco_sync_jobs.id 
      AND status = 'completed'
    ) THEN 'completed'
    ELSE 'cancelled'
  END,
  completed_at = now(),
  error_message = 'Auto-cleaned: zombie job with no pending work'
WHERE status IN ('pending', 'processing')
AND started_at < now() - interval '1 hour'
AND NOT EXISTS (
  SELECT 1 FROM pco_sync_queue 
  WHERE sync_job_id = pco_sync_jobs.id 
  AND status IN ('pending', 'processing', 'retrying')
);
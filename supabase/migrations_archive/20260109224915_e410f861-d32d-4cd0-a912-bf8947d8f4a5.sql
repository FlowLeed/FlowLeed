
-- Cancel old sync jobs that were created before the optimization was deployed
-- These jobs don't have included_data (addresses, field_data, householdId) in their chunks

UPDATE pco_sync_jobs 
SET status = 'cancelled', 
    completed_at = now(), 
    error_message = 'Cancelled - job created before sync optimization. Please trigger a new sync.'
WHERE list_mapping_id IS NULL 
AND status IN ('pending', 'processing');

-- Also cancel the corresponding queue chunks
UPDATE pco_sync_queue 
SET status = 'cancelled'
WHERE sync_job_id IN (
  SELECT id FROM pco_sync_jobs 
  WHERE list_mapping_id IS NULL 
  AND status = 'cancelled'
  AND error_message LIKE 'Cancelled - job created before sync optimization%'
)
AND status IN ('pending', 'processing');

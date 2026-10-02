-- Force cancel all old sync jobs that are still stuck
UPDATE pco_sync_jobs 
SET status = 'cancelled', 
    completed_at = now()
WHERE id = '3e7c52ca-3e7a-4904-bfa6-67580f7e876b';

-- Also cancel any related queue items
UPDATE pco_sync_queue 
SET status = 'cancelled'
WHERE sync_job_id = '3e7c52ca-3e7a-4904-bfa6-67580f7e876b'
AND status IN ('pending', 'processing', 'retrying');
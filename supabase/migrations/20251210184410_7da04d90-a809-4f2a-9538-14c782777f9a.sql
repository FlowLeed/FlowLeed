-- Mark old stuck chunks as failed (instead of cancelled which isn't a valid status)
UPDATE pco_sync_queue
SET status = 'failed', error_message = 'Stale chunk - timed out after 1 hour'
WHERE status IN ('processing', 'pending')
AND created_at < NOW() - INTERVAL '1 hour';

-- Also mark duplicate jobs for the same list as failed (keep only the most recent)
WITH ranked_jobs AS (
  SELECT id, list_mapping_id, created_at,
    ROW_NUMBER() OVER (PARTITION BY list_mapping_id ORDER BY created_at DESC) as rn
  FROM pco_sync_jobs
  WHERE status IN ('pending', 'processing')
)
UPDATE pco_sync_jobs 
SET status = 'failed', error_message = 'Superseded by newer sync job'
WHERE id IN (SELECT id FROM ranked_jobs WHERE rn > 1);
-- Reset chunks stuck in "processing" for more than 10 minutes
UPDATE pco_sync_queue 
SET status = 'pending', 
    retry_count = COALESCE(retry_count, 0) + 1,
    updated_at = NOW()
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '10 minutes';
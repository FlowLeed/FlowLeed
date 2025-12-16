-- Step 1: Add 'cancelled' status to pco_sync_jobs CHECK constraint
ALTER TABLE pco_sync_jobs DROP CONSTRAINT IF EXISTS pco_sync_jobs_status_check;
ALTER TABLE pco_sync_jobs ADD CONSTRAINT pco_sync_jobs_status_check 
  CHECK (status = ANY (ARRAY['pending', 'processing', 'completed', 'failed', 'cancelled']));

-- Step 2: Add 'cancelled' status to pco_sync_queue CHECK constraint  
ALTER TABLE pco_sync_queue DROP CONSTRAINT IF EXISTS pco_sync_queue_status_check;
ALTER TABLE pco_sync_queue ADD CONSTRAINT pco_sync_queue_status_check 
  CHECK (status = ANY (ARRAY['pending', 'processing', 'completed', 'failed', 'retrying', 'cancelled']));

-- Step 3: Clean up duplicate contact_demographics (keep only the most recent one per contact)
DELETE FROM contact_demographics 
WHERE id NOT IN (
  SELECT DISTINCT ON (contact_id) id 
  FROM contact_demographics 
  ORDER BY contact_id, updated_at DESC
);

-- Step 4: Add UNIQUE constraint for contact_demographics (for ON CONFLICT upserts)
ALTER TABLE contact_demographics 
  DROP CONSTRAINT IF EXISTS contact_demographics_contact_id_key;
ALTER TABLE contact_demographics 
  ADD CONSTRAINT contact_demographics_contact_id_key UNIQUE (contact_id);

-- Step 5: Clean up duplicate contact_addresses (keep only most recent per contact + type)
DELETE FROM contact_addresses 
WHERE id NOT IN (
  SELECT DISTINCT ON (contact_id, address_type) id 
  FROM contact_addresses 
  ORDER BY contact_id, address_type, updated_at DESC
);

-- Step 6: Add UNIQUE constraint for contact_addresses (for ON CONFLICT upserts)
ALTER TABLE contact_addresses 
  DROP CONSTRAINT IF EXISTS contact_addresses_contact_id_address_type_key;
ALTER TABLE contact_addresses 
  ADD CONSTRAINT contact_addresses_contact_id_address_type_key UNIQUE (contact_id, address_type);

-- Step 7: Add partial unique index for contact_family_members (only for PCO-synced records)
DROP INDEX IF EXISTS contact_family_members_contact_pc_person_unique;
CREATE UNIQUE INDEX contact_family_members_contact_pc_person_unique 
  ON contact_family_members (contact_id, pc_person_id) 
  WHERE pc_person_id IS NOT NULL;

-- Step 8: Update all existing integrations from old frequencies to 'daily'
UPDATE integrations 
SET sync_frequency = 'daily' 
WHERE sync_frequency IN ('every_5_minutes', 'every_15_minutes', 'every_30_minutes', 'hourly', 'weekly')
  OR sync_frequency IS NULL;

-- Step 9: Mark all stuck pending jobs (older than 1 hour with 0 processed contacts) as failed
UPDATE pco_sync_jobs 
SET status = 'failed', 
    error_message = 'Automatically marked as failed - stuck job cleanup',
    completed_at = now()
WHERE status = 'pending' 
  AND processed_contacts = 0 
  AND created_at < now() - interval '1 hour';

-- Step 10: Cancel orphaned queue items for failed/cancelled jobs
UPDATE pco_sync_queue 
SET status = 'cancelled'
WHERE status = 'pending' 
  AND sync_job_id IN (
    SELECT id FROM pco_sync_jobs WHERE status IN ('failed', 'cancelled')
  );
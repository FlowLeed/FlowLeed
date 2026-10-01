-- Phase 1: Add organization-level fairness to sync queue
-- This enables round-robin processing across organizations

-- Add organization_id column to pco_sync_queue
ALTER TABLE pco_sync_queue 
ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Create index for fast organization-based lookups
CREATE INDEX IF NOT EXISTS idx_sync_queue_org_status_created 
ON pco_sync_queue(organization_id, status, created_at);

-- Backfill organization_id for existing rows from their parent job
UPDATE pco_sync_queue sq
SET organization_id = j.organization_id
FROM pco_sync_jobs j
WHERE sq.sync_job_id = j.id
  AND sq.organization_id IS NULL;

-- Add foreign key constraint for data integrity
ALTER TABLE pco_sync_queue
ADD CONSTRAINT fk_sync_queue_organization
FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Make organization_id NOT NULL after backfill
ALTER TABLE pco_sync_queue
ALTER COLUMN organization_id SET NOT NULL;
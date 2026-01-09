-- Add pc_household_id column to contacts table for local household matching
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS pc_household_id TEXT;

-- Create index for efficient household matching queries
CREATE INDEX IF NOT EXISTS idx_contacts_household 
ON contacts(organization_id, pc_household_id) 
WHERE pc_household_id IS NOT NULL;

-- Add last_full_sync_completed_at column to integrations for tracking incremental sync
-- This tracks when sync actually COMPLETED (not started), important for delta calculation
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS last_full_sync_completed_at TIMESTAMPTZ;
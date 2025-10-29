-- Fix 1: Clean up existing duplicates (keep only the oldest Maria Garcia)
-- Delete all but the oldest contact for each (pc_person_id, organization_id) combination
DELETE FROM contacts
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY pc_person_id, organization_id ORDER BY created_at ASC) as rn
    FROM contacts
    WHERE pc_person_id IS NOT NULL
  ) t
  WHERE rn > 1
);

-- Fix 2: Add unique constraint to prevent future duplicates
-- This ensures each Planning Center person can only exist once per organization
CREATE UNIQUE INDEX IF NOT EXISTS contacts_pc_person_org_unique 
ON contacts(pc_person_id, organization_id) 
WHERE pc_person_id IS NOT NULL;

-- Fix 3: Also add unique constraint for pipeline_contacts to prevent same contact in multiple stages
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_contacts_contact_pipeline_unique 
ON pipeline_contacts(contact_id, pipeline_id);
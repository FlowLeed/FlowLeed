-- Drop the partial unique index that doesn't work with ON CONFLICT
DROP INDEX IF EXISTS contact_family_members_contact_pc_person_unique;

-- Create a proper unique constraint for PCO-synced family members
-- This allows ON CONFLICT (contact_id, pc_person_id) to work correctly
ALTER TABLE contact_family_members 
  DROP CONSTRAINT IF EXISTS contact_family_members_contact_pc_person_unique;

ALTER TABLE contact_family_members 
  ADD CONSTRAINT contact_family_members_contact_pc_person_unique 
  UNIQUE (contact_id, pc_person_id);
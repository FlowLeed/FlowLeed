-- Add new columns to contact_family_members for household data
ALTER TABLE contact_family_members 
  ADD COLUMN avatar text,
  ADD COLUMN is_child boolean DEFAULT false,
  ADD COLUMN pc_person_id text;

-- Add index for performance
CREATE INDEX idx_contact_family_members_pc_person_id 
  ON contact_family_members(pc_person_id) 
  WHERE pc_person_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN contact_family_members.avatar IS 'URL to the person avatar/photo';
COMMENT ON COLUMN contact_family_members.is_child IS 'Whether this person is a child (under 18)';
COMMENT ON COLUMN contact_family_members.pc_person_id IS 'Planning Center person ID for sync tracking';
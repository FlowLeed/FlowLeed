-- Transfer ownership of The Connect Church organization
-- Promote molodist+7@gmail.com (Great Admin) to owner
UPDATE organization_members 
SET role = 'owner'
WHERE organization_id = 'b4bb58b1-8882-4de7-bc9b-716c8171acb5'
  AND user_id = '73735264-8208-4609-b50a-c6624233d06a';

-- Demote alex@thepromisecenter.com to member
UPDATE organization_members 
SET role = 'member'
WHERE organization_id = 'b4bb58b1-8882-4de7-bc9b-716c8171acb5'
  AND user_id = 'c4cb1885-fa84-4ba6-aeb4-df5bc04fee46';
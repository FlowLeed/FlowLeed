-- Add foreign key constraint from invitations to organizations
ALTER TABLE invitations 
ADD CONSTRAINT invitations_organization_id_fkey 
FOREIGN KEY (organization_id) 
REFERENCES organizations(id) 
ON DELETE CASCADE;

-- Add foreign key constraint from invitations to profiles
ALTER TABLE invitations 
ADD CONSTRAINT invitations_invited_by_user_id_fkey 
FOREIGN KEY (invited_by_user_id) 
REFERENCES profiles(user_id) 
ON DELETE CASCADE;
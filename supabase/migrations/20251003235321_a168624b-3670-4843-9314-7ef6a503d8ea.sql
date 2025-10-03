-- Mark invitation as accepted when user already exists and is in the organization
UPDATE invitations
SET accepted_at = NOW()
WHERE email = 'molodist+3@gmail.com'
AND accepted_at IS NULL;
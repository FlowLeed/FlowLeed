-- Allow users to view profiles of members in their organizations
CREATE POLICY "Users can view profiles in their organization"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
    AND om2.user_id = profiles.user_id
  )
);
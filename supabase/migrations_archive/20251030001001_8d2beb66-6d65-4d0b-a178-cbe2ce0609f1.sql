-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can delete their own integrations" ON integrations;

-- Create a new policy that allows org admins/owners to delete
CREATE POLICY "Org admins can delete integrations"
ON integrations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = integrations.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  )
);
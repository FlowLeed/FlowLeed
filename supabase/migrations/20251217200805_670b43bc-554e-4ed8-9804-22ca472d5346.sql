-- Allow org members to view pipeline_contacts for contacts in their organization
-- This enables the flow filter on the contacts page to work for all org members
CREATE POLICY "Org members can view pipeline contacts in their organization"
ON public.pipeline_contacts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM contacts c
    JOIN organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = pipeline_contacts.contact_id 
    AND om.user_id = auth.uid()
  )
);
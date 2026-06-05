
-- 1. Composite index for the visibility lookup
CREATE INDEX IF NOT EXISTS idx_upvp_user_org_person
  ON public.user_pco_visible_people (user_id, organization_id, pc_person_id);

-- Helpful supporting index on contacts (no-op if already present)
CREATE INDEX IF NOT EXISTS idx_contacts_org_pcperson
  ON public.contacts (organization_id, pc_person_id);

-- 2. Replace the slow SELECT policy on contacts
DROP POLICY IF EXISTS "Users can view contacts in their organization" ON public.contacts;

CREATE POLICY "Users can view contacts in their organization"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contacts.organization_id
      AND om.user_id = auth.uid()
  )
  AND (
    -- Enforcement off for this org → everyone in the org sees everything
    NOT COALESCE(
      (SELECT pco_enforce_user_permissions
         FROM public.organizations
        WHERE id = contacts.organization_id), false)
    -- Owners/admins always see everything
    OR EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = contacts.organization_id
        AND om2.user_id = auth.uid()
        AND om2.role IN ('owner','admin')
    )
    -- Contact isn't tied to a PCO person → visible
    OR contacts.pc_person_id IS NULL
    -- User has no active personal PCO connection → don't gate them
    OR NOT EXISTS (
      SELECT 1 FROM public.user_pco_connections upc
      WHERE upc.user_id = auth.uid()
        AND upc.organization_id = contacts.organization_id
        AND upc.status = 'active'
    )
    -- Otherwise the contact must be in the user's visible set
    OR EXISTS (
      SELECT 1 FROM public.user_pco_visible_people v
      WHERE v.user_id = auth.uid()
        AND v.organization_id = contacts.organization_id
        AND v.pc_person_id = contacts.pc_person_id
    )
  )
);

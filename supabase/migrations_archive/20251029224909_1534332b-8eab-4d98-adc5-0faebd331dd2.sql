-- Helper: return active impersonation target org for an admin
CREATE OR REPLACE FUNCTION public.get_impersonation_org_id(_admin_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_organization_id
  FROM public.impersonation_sessions
  WHERE system_admin_user_id = _admin_user_id
    AND is_active = true
    AND started_at > NOW() - INTERVAL '4 hours'
  ORDER BY started_at DESC
  LIMIT 1;
$$;

-- Organizations
DROP POLICY IF EXISTS "Impersonating admin can view target org" ON public.organizations;
CREATE POLICY "Impersonating admin can view target org"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  AND is_currently_impersonating(auth.uid())
  AND id = get_impersonation_org_id(auth.uid())
);

-- Organization members
DROP POLICY IF EXISTS "Impersonating admin can view target org members" ON public.organization_members;
CREATE POLICY "Impersonating admin can view target org members"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  AND is_currently_impersonating(auth.uid())
  AND organization_id = get_impersonation_org_id(auth.uid())
);

-- Contacts
DROP POLICY IF EXISTS "Impersonating admin can view target org contacts" ON public.contacts;
CREATE POLICY "Impersonating admin can view target org contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  AND is_currently_impersonating(auth.uid())
  AND organization_id = get_impersonation_org_id(auth.uid())
);

-- Pipelines
DROP POLICY IF EXISTS "Impersonating admin can view target org pipelines" ON public.pipelines;
CREATE POLICY "Impersonating admin can view target org pipelines"
ON public.pipelines
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  AND is_currently_impersonating(auth.uid())
  AND organization_id = get_impersonation_org_id(auth.uid())
);

-- Pipeline stages
DROP POLICY IF EXISTS "Impersonating admin can view target org stages" ON public.pipeline_stages;
CREATE POLICY "Impersonating admin can view target org stages"
ON public.pipeline_stages
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  AND is_currently_impersonating(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.pipelines p
    WHERE p.id = pipeline_id
      AND p.organization_id = get_impersonation_org_id(auth.uid())
  )
);

-- Pipeline contacts
DROP POLICY IF EXISTS "Impersonating admin can view target org pipeline contacts" ON public.pipeline_contacts;
CREATE POLICY "Impersonating admin can view target org pipeline contacts"
ON public.pipeline_contacts
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  AND is_currently_impersonating(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.pipelines p
    WHERE p.id = pipeline_id
      AND p.organization_id = get_impersonation_org_id(auth.uid())
  )
);

-- Pipeline team members
DROP POLICY IF EXISTS "Impersonating admin can view target org pipeline team" ON public.pipeline_team_members;
CREATE POLICY "Impersonating admin can view target org pipeline team"
ON public.pipeline_team_members
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  AND is_currently_impersonating(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.pipelines p
    WHERE p.id = pipeline_id
      AND p.organization_id = get_impersonation_org_id(auth.uid())
  )
);

-- Contact interactions
DROP POLICY IF EXISTS "Impersonating admin can view target org interactions" ON public.contact_interactions;
CREATE POLICY "Impersonating admin can view target org interactions"
ON public.contact_interactions
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  AND is_currently_impersonating(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_id
      AND c.organization_id = get_impersonation_org_id(auth.uid())
  )
);

-- Contact notes
DROP POLICY IF EXISTS "Impersonating admin can view target org notes" ON public.contact_notes;
CREATE POLICY "Impersonating admin can view target org notes"
ON public.contact_notes
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  AND is_currently_impersonating(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_id
      AND c.organization_id = get_impersonation_org_id(auth.uid())
  )
);

-- Contact tags
DROP POLICY IF EXISTS "Impersonating admin can view target org tags" ON public.contact_tags;
CREATE POLICY "Impersonating admin can view target org tags"
ON public.contact_tags
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  AND is_currently_impersonating(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_id
      AND c.organization_id = get_impersonation_org_id(auth.uid())
  )
);

-- Prayer requests
DROP POLICY IF EXISTS "Impersonating admin can view target org prayers" ON public.contact_prayer_requests;
CREATE POLICY "Impersonating admin can view target org prayers"
ON public.contact_prayer_requests
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  AND is_currently_impersonating(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_id
      AND c.organization_id = get_impersonation_org_id(auth.uid())
  )
);

-- Demographics
DROP POLICY IF EXISTS "Impersonating admin can view target org demographics" ON public.contact_demographics;
CREATE POLICY "Impersonating admin can view target org demographics"
ON public.contact_demographics
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  AND is_currently_impersonating(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_id
      AND c.organization_id = get_impersonation_org_id(auth.uid())
  )
);

-- Addresses
DROP POLICY IF EXISTS "Impersonating admin can view target org addresses" ON public.contact_addresses;
CREATE POLICY "Impersonating admin can view target org addresses"
ON public.contact_addresses
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  AND is_currently_impersonating(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_id
      AND c.organization_id = get_impersonation_org_id(auth.uid())
  )
);

-- Family members
DROP POLICY IF EXISTS "Impersonating admin can view target org family" ON public.contact_family_members;
CREATE POLICY "Impersonating admin can view target org family"
ON public.contact_family_members
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  AND is_currently_impersonating(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_id
      AND c.organization_id = get_impersonation_org_id(auth.uid())
  )
);
-- Create function to detect active impersonation sessions
CREATE OR REPLACE FUNCTION public.is_currently_impersonating(_admin_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.impersonation_sessions
    WHERE system_admin_user_id = _admin_user_id
      AND is_active = true
      AND started_at > NOW() - INTERVAL '4 hours'
  );
$$;

-- Update pipelines RLS policy
DROP POLICY IF EXISTS "System admins can view all pipelines" ON public.pipelines;
CREATE POLICY "System admins can view all pipelines"
ON public.pipelines
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  AND NOT is_currently_impersonating(auth.uid())
);

-- Update pipeline_stages RLS policy
DROP POLICY IF EXISTS "System admins can view all pipeline stages" ON public.pipeline_stages;
CREATE POLICY "System admins can view all pipeline stages"
ON public.pipeline_stages
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  AND NOT is_currently_impersonating(auth.uid())
);

-- Update pipeline_contacts RLS policy
DROP POLICY IF EXISTS "System admins can view all pipeline contacts" ON public.pipeline_contacts;
CREATE POLICY "System admins can view all pipeline contacts"
ON public.pipeline_contacts
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  AND NOT is_currently_impersonating(auth.uid())
);

-- Update pipeline_team_members RLS policy
DROP POLICY IF EXISTS "System admins can view all pipeline team members" ON public.pipeline_team_members;
CREATE POLICY "System admins can view all pipeline team members"
ON public.pipeline_team_members
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  AND NOT is_currently_impersonating(auth.uid())
);

-- Update contacts RLS policy
DROP POLICY IF EXISTS "System admins can view all contacts" ON public.contacts;
CREATE POLICY "System admins can view all contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  AND NOT is_currently_impersonating(auth.uid())
);

-- Update contact_tags RLS policy
DROP POLICY IF EXISTS "System admins can view all contact tags" ON public.contact_tags;
CREATE POLICY "System admins can view all contact tags"
ON public.contact_tags
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  AND NOT is_currently_impersonating(auth.uid())
);

-- Update contact_interactions RLS policy
DROP POLICY IF EXISTS "System admins can view all contact interactions" ON public.contact_interactions;
CREATE POLICY "System admins can view all contact interactions"
ON public.contact_interactions
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  AND NOT is_currently_impersonating(auth.uid())
);

-- Update contact_notes RLS policy
DROP POLICY IF EXISTS "System admins can view all contact notes" ON public.contact_notes;
CREATE POLICY "System admins can view all contact notes"
ON public.contact_notes
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  AND NOT is_currently_impersonating(auth.uid())
);

-- Update contact_prayer_requests RLS policy
DROP POLICY IF EXISTS "System admins can view all prayer requests" ON public.contact_prayer_requests;
CREATE POLICY "System admins can view all prayer requests"
ON public.contact_prayer_requests
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  AND NOT is_currently_impersonating(auth.uid())
);

-- Update contact_demographics RLS policy
DROP POLICY IF EXISTS "System admins can view all contact demographics" ON public.contact_demographics;
CREATE POLICY "System admins can view all contact demographics"
ON public.contact_demographics
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  AND NOT is_currently_impersonating(auth.uid())
);

-- Update contact_addresses RLS policy
DROP POLICY IF EXISTS "System admins can view all contact addresses" ON public.contact_addresses;
CREATE POLICY "System admins can view all contact addresses"
ON public.contact_addresses
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  AND NOT is_currently_impersonating(auth.uid())
);

-- Update contact_family_members RLS policy
DROP POLICY IF EXISTS "System admins can view all contact family members" ON public.contact_family_members;
CREATE POLICY "System admins can view all contact family members"
ON public.contact_family_members
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  AND NOT is_currently_impersonating(auth.uid())
);

-- Update organization_members RLS policy
DROP POLICY IF EXISTS "System admins can view all organization members" ON public.organization_members;
CREATE POLICY "System admins can view all organization members"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  AND NOT is_currently_impersonating(auth.uid())
);

-- Update organizations RLS policy
DROP POLICY IF EXISTS "System admins can view all organizations" ON public.organizations;
CREATE POLICY "System admins can view all organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  AND NOT is_currently_impersonating(auth.uid())
);
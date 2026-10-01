-- Allow system admins to view all pipelines for impersonation and support
CREATE POLICY "System admins can view all pipelines"
ON public.pipelines
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

-- Allow system admins to view all pipeline stages
CREATE POLICY "System admins can view all pipeline stages"
ON public.pipeline_stages
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

-- Allow system admins to view all pipeline contacts
CREATE POLICY "System admins can view all pipeline contacts"
ON public.pipeline_contacts
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

-- Allow system admins to view all pipeline team members
CREATE POLICY "System admins can view all pipeline team members"
ON public.pipeline_team_members
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

-- Allow system admins to view all contacts
CREATE POLICY "System admins can view all contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

-- Allow system admins to view all contact tags
CREATE POLICY "System admins can view all contact tags"
ON public.contact_tags
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));
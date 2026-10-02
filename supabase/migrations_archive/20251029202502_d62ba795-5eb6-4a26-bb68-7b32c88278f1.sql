-- Allow system admins to view organization members for impersonation and support
CREATE POLICY "System admins can view all organization members"
ON public.organization_members
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));
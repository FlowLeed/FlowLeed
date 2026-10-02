-- Allow system admins to view all profiles for impersonation and support
CREATE POLICY "System admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));
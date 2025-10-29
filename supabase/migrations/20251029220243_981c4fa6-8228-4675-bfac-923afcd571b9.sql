-- Drop recursive policies that cause infinite recursion
DROP POLICY IF EXISTS "Super admins can manage system roles" ON public.system_user_roles;
DROP POLICY IF EXISTS "System admins can view all system roles" ON public.system_user_roles;

-- Allow users to view their own role rows only (non-recursive, safe)
CREATE POLICY "Users can view their own system roles"
ON public.system_user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
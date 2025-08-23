-- First, drop the existing problematic policies
DROP POLICY IF EXISTS "Organization owners and admins can manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view members of their organizations" ON public.organization_members;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.get_user_organization_role(_user_id uuid, _organization_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.organization_members 
  WHERE user_id = _user_id AND organization_id = _organization_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_user_in_organization(_user_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE user_id = _user_id AND organization_id = _organization_id
  );
$$;

-- Create new non-recursive policies
CREATE POLICY "Users can view members of their organizations"
ON public.organization_members
FOR SELECT
TO authenticated
USING (public.is_user_in_organization(auth.uid(), organization_id));

CREATE POLICY "Organization owners and admins can manage members"
ON public.organization_members
FOR ALL
TO authenticated
USING (
  public.get_user_organization_role(auth.uid(), organization_id) IN ('owner', 'admin')
);
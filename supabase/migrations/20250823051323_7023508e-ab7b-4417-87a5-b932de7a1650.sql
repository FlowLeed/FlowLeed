-- Fix the security warnings by setting search_path for the functions
CREATE OR REPLACE FUNCTION public.get_user_organization_role(_user_id uuid, _organization_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
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
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE user_id = _user_id AND organization_id = _organization_id
  );
$$;
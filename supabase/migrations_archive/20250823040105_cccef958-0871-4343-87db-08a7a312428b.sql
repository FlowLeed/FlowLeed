-- Fix security warnings by setting search_path for functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  org_id UUID;
BEGIN
  -- Insert user profile
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Create organization for new user
  INSERT INTO public.organizations (name, slug)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'organization_name', split_part(NEW.email, '@', 1) || '''s Organization'),
    LOWER(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data->>'organization_name', split_part(NEW.email, '@', 1)), '[^a-zA-Z0-9]', '-', 'g'))
  )
  RETURNING id INTO org_id;
  
  -- Make user owner of their organization
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$;

-- Fix security warnings by setting search_path for update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
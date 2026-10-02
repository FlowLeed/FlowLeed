-- Fix organization creation to only happen for non-invited users
-- Drop and recreate the function with updated logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
  skip_org BOOLEAN;
BEGIN
  -- Insert user profile (always needed)
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Check if we should skip org creation (invited user)
  skip_org := COALESCE((NEW.raw_user_meta_data->>'skip_org_creation')::boolean, false);
  
  -- Only create organization if not invited
  IF NOT skip_org THEN
    INSERT INTO public.organizations (name, slug)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'organization_name', split_part(NEW.email, '@', 1) || '''s Organization'),
      LOWER(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data->>'organization_name', split_part(NEW.email, '@', 1)), '[^a-zA-Z0-9]', '-', 'g'))
    )
    RETURNING id INTO org_id;
    
    -- Make user owner of their organization
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (org_id, NEW.id, 'owner');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
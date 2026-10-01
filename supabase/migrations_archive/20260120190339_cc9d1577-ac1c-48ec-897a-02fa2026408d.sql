CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
  skip_org BOOLEAN;
  base_slug TEXT;
  final_slug TEXT;
  slug_exists BOOLEAN;
  suffix_num INTEGER := 1;
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
    -- Generate base slug from organization name
    base_slug := LOWER(REGEXP_REPLACE(
      COALESCE(NEW.raw_user_meta_data->>'organization_name', split_part(NEW.email, '@', 1)),
      '[^a-zA-Z0-9]+', '-', 'g'
    ));
    -- Remove leading/trailing hyphens
    base_slug := TRIM(BOTH '-' FROM base_slug);
    
    -- Start with base slug
    final_slug := base_slug;
    
    -- Loop to find available slug (with numbered suffix if needed)
    LOOP
      SELECT EXISTS(SELECT 1 FROM public.organizations WHERE slug = final_slug) INTO slug_exists;
      EXIT WHEN NOT slug_exists OR suffix_num > 10;
      final_slug := base_slug || '-' || suffix_num;
      suffix_num := suffix_num + 1;
    END LOOP;
    
    -- If still exists after 10 attempts, add random suffix
    IF slug_exists THEN
      final_slug := base_slug || '-' || SUBSTRING(md5(random()::text) FROM 1 FOR 6);
    END IF;
    
    INSERT INTO public.organizations (name, slug)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'organization_name', split_part(NEW.email, '@', 1) || '''s Organization'),
      final_slug
    )
    RETURNING id INTO org_id;
    
    -- Make user owner of their organization
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (org_id, NEW.id, 'owner');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
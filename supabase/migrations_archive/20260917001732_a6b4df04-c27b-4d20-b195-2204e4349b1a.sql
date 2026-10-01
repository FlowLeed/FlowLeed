-- 1. Security definer view -> invoker
ALTER VIEW public.impersonation_audit_log SET (security_invoker = on);

-- 2. Remove full-row anon/authenticated access to organizations
DROP POLICY IF EXISTS "Anon can view orgs with public content" ON public.organizations;
DROP POLICY IF EXISTS "Anon can view orgs with public groups" ON public.organizations;

-- Safe public lookup exposing only non-sensitive columns
CREATE OR REPLACE FUNCTION public.get_public_organization(p_slug text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.slug, o.logo_url
  FROM public.organizations o
  WHERE o.slug = p_slug
    AND (
      EXISTS (
        SELECT 1 FROM public.content_videos v
        WHERE v.organization_id = o.id
          AND v.consent_level = 'public_search'::content_consent_level
      )
      OR EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.organization_id = o.id
          AND g.visibility = 'public'
          AND g.status = 'active'
          AND g.archived_at IS NULL
      )
    )
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_public_organization(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_organization(text) TO anon, authenticated;
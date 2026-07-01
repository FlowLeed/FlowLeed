CREATE POLICY "Anon can view orgs with public groups"
ON public.organizations FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.groups g
  WHERE g.organization_id = organizations.id
    AND g.visibility = 'public'
    AND g.status = 'active'
    AND g.archived_at IS NULL
));
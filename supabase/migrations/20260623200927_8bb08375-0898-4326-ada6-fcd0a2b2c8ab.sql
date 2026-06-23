CREATE POLICY "Anon can view orgs with public content"
ON public.organizations
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.content_videos v
    WHERE v.organization_id = organizations.id
      AND v.consent_level = 'public_search'
  )
);
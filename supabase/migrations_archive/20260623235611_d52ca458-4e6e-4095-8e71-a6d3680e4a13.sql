
-- Read: any authenticated org member can view their org's logo
CREATE POLICY "Org members can read org logos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'org-logos'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id::text = (storage.foldername(name))[1]
      AND om.user_id = auth.uid()
  )
);

-- Insert/Update/Delete: only owners and admins
CREATE POLICY "Org admins can upload org logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-logos'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id::text = (storage.foldername(name))[1]
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
);

CREATE POLICY "Org admins can update org logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'org-logos'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id::text = (storage.foldername(name))[1]
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
);

CREATE POLICY "Org admins can delete org logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'org-logos'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id::text = (storage.foldername(name))[1]
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
);

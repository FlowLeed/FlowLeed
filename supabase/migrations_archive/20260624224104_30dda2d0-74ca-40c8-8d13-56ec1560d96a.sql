
-- Public read
CREATE POLICY "content-thumbnails public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'content-thumbnails');

-- Org admin write/update/delete (path is <organization_id>/<file>)
CREATE POLICY "content-thumbnails org admin insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'content-thumbnails'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id::text = (storage.foldername(name))[1]
      AND om.role IN ('owner','admin')
  )
);

CREATE POLICY "content-thumbnails org admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'content-thumbnails'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id::text = (storage.foldername(name))[1]
      AND om.role IN ('owner','admin')
  )
);

CREATE POLICY "content-thumbnails org admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'content-thumbnails'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id::text = (storage.foldername(name))[1]
      AND om.role IN ('owner','admin')
  )
);

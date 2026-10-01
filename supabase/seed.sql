-- Create Storage Buckers
insert into storage.buckets (id, name, public) values
  ('avatars','avatars',true), 
  ('group-images','group-images',true),
  ('story-media','story-media',true), 
  ('org-logos','org-logos',true),
  ('content-thumbnails','content-thumbnails',true)
on conflict (id) do nothing;



-- Policies for Avatar Image Buckets
CREATE POLICY "Avatar images are publicly accessible" 
    ON storage.objects 
    FOR SELECT 
    USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
    ON storage.objects 
    FOR INSERT 
    WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar" 
    ON storage.objects 
    FOR UPDATE 
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar" 
    ON storage.objects 
    FOR DELETE 
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);



-- Policies for Group Image Buckets
CREATE POLICY "Org members can upload group images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'group-images'
    AND public.user_can_manage_group_image(name)
  );

CREATE POLICY "Org members can update their group images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'group-images'
    AND public.user_can_manage_group_image(name)
  )
  WITH CHECK (
    bucket_id = 'group-images'
    AND public.user_can_manage_group_image(name)
  );

CREATE POLICY "Org members can delete their group images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'group-images'
    AND public.user_can_manage_group_image(name)
  );

-- Allow anyone to view group images (public bucket)
CREATE POLICY "Anyone can view group images"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'group-images');



-- Policies for Organization Logo Buckets
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


-- Policies for Content Thumbnail Buckets
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


-- Policies for Story Media Buckets
CREATE POLICY "story media public read" 
    ON storage.objects FOR SELECT 
    TO public 
    USING (bucket_id = 'story-media');

CREATE POLICY "story media org admins upload" 
    ON storage.objects FOR INSERT TO 
    authenticated 
    WITH CHECK (
        bucket_id = 'story-media' 
        AND public.get_user_organization_role(auth.uid(), ((storage.foldername(name))[1])::uuid) 
        IN ('owner','admin')
    );

CREATE POLICY "story media org admins update" 
    ON storage.objects FOR UPDATE 
    TO authenticated 
    USING (
        bucket_id = 'story-media' 
        AND public.get_user_organization_role(auth.uid(), ((storage.foldername(name))[1])::uuid) 
        IN ('owner','admin')
    ) 
    WITH CHECK (
        bucket_id = 'story-media' 
        AND public.get_user_organization_role(auth.uid(), ((storage.foldername(name))[1])::uuid) 
        IN ('owner','admin')
    );

CREATE POLICY "story media org admins delete" 
    ON storage.objects FOR DELETE 
    TO authenticated 
    USING (
        bucket_id = 'story-media' 
        AND public.get_user_organization_role(auth.uid(), ((storage.foldername(name))[1])::uuid) 
        IN ('owner','admin')
    );

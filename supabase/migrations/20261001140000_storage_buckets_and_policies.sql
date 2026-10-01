-- Storage buckets and the storage.objects policies that control who can read and write them.
-- The production schema dump (the baseline) covers the public schema only, so these were first
-- recreated in seed.sql. They live here now because hosted projects need them and
-- `supabase db push` never runs seed.sql.
--
-- Safe to run where they already exist (production): buckets are inserted only when missing,
-- and each policy is created only when no policy with that name exists, so existing buckets and
-- policies are left exactly as they are. To change a policy later, drop and recreate it in a
-- new migration.

-- Buckets. Existing buckets keep their current settings.
insert into storage.buckets (id, name, public) values
  ('avatars','avatars',true),
  ('group-images','group-images',true),
  ('story-media','story-media',true),
  ('org-logos','org-logos',true),
  ('content-thumbnails','content-thumbnails',true)
on conflict (id) do nothing;

-- Policies for Avatar Image Buckets
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Avatar images are publicly accessible') THEN
    CREATE POLICY "Avatar images are publicly accessible"
        ON storage.objects
        FOR SELECT
        USING (bucket_id = 'avatars');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own avatar') THEN
    CREATE POLICY "Users can upload their own avatar"
        ON storage.objects
        FOR INSERT
        WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own avatar') THEN
    CREATE POLICY "Users can update their own avatar"
        ON storage.objects
        FOR UPDATE
        USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own avatar') THEN
    CREATE POLICY "Users can delete their own avatar"
        ON storage.objects
        FOR DELETE
        USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- Policies for Group Image Buckets
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Org members can upload group images') THEN
    CREATE POLICY "Org members can upload group images"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'group-images'
        AND public.user_can_manage_group_image(name)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Org members can update their group images') THEN
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
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Org members can delete their group images') THEN
    CREATE POLICY "Org members can delete their group images"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'group-images'
        AND public.user_can_manage_group_image(name)
      );
  END IF;
END $$;

-- Allow anyone to view group images (public bucket)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can view group images') THEN
    CREATE POLICY "Anyone can view group images"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'group-images');
  END IF;
END $$;

-- Policies for Organization Logo Buckets
-- Read: any authenticated org member can view their org's logo
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Org members can read org logos') THEN
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
  END IF;
END $$;

-- Insert/Update/Delete: only owners and admins
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Org admins can upload org logos') THEN
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
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Org admins can update org logos') THEN
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
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Org admins can delete org logos') THEN
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
  END IF;
END $$;

-- Policies for Content Thumbnail Buckets
-- Public read
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'content-thumbnails public read') THEN
    CREATE POLICY "content-thumbnails public read"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'content-thumbnails');
  END IF;
END $$;

-- Org admin write/update/delete (path is <organization_id>/<file>)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'content-thumbnails org admin insert') THEN
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
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'content-thumbnails org admin update') THEN
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
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'content-thumbnails org admin delete') THEN
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
  END IF;
END $$;

-- Policies for Story Media Buckets
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'story media public read') THEN
    CREATE POLICY "story media public read"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'story-media');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'story media org admins upload') THEN
    CREATE POLICY "story media org admins upload"
        ON storage.objects FOR INSERT TO
        authenticated
        WITH CHECK (
            bucket_id = 'story-media'
            AND public.get_user_organization_role(auth.uid(), ((storage.foldername(name))[1])::uuid)
            IN ('owner','admin')
        );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'story media org admins update') THEN
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
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'story media org admins delete') THEN
    CREATE POLICY "story media org admins delete"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (
            bucket_id = 'story-media'
            AND public.get_user_organization_role(auth.uid(), ((storage.foldername(name))[1])::uuid)
            IN ('owner','admin')
        );
  END IF;
END $$;

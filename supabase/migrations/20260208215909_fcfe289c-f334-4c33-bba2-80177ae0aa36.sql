-- Add image_url column to groups table
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for group images
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-images', 'group-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload group images
CREATE POLICY "Authenticated users can upload group images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'group-images');

-- Allow anyone to view group images (public bucket)
CREATE POLICY "Anyone can view group images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'group-images');

-- Allow authenticated users to update their group images
CREATE POLICY "Authenticated users can update group images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'group-images');

-- Allow authenticated users to delete group images
CREATE POLICY "Authenticated users can delete group images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'group-images');
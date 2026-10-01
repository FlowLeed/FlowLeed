CREATE POLICY "Anyone can view listed groups"
ON public.groups
FOR SELECT
USING (visibility = 'public' AND status = 'active' AND archived_at IS NULL);
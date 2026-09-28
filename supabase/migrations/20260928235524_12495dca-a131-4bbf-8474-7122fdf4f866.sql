DROP POLICY IF EXISTS "content_story_cta_defaults authenticated can view" ON public.content_story_cta_defaults;
DROP POLICY IF EXISTS "content_story_cta_defaults public can view" ON public.content_story_cta_defaults;

DROP POLICY IF EXISTS "Public read group settings" ON public.group_settings;
CREATE POLICY "Org members can view group settings" ON public.group_settings
FOR SELECT TO authenticated
USING (public.is_user_in_organization(auth.uid(), organization_id) OR public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Public read group types" ON public.group_type_definitions;

DROP POLICY IF EXISTS "Anyone can read marker definitions" ON public.marker_definitions;
CREATE POLICY "Signed-in users can read marker definitions" ON public.marker_definitions
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
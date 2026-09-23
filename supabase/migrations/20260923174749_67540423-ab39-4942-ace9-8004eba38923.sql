DROP POLICY IF EXISTS "Public can read story CTA defaults" ON public.content_story_cta_defaults;
DROP POLICY IF EXISTS "Authenticated can read story CTA defaults" ON public.content_story_cta_defaults;
DROP POLICY IF EXISTS "Story CTA defaults are publicly readable" ON public.content_story_cta_defaults;
DROP POLICY IF EXISTS "CTA defaults are readable" ON public.content_story_cta_defaults;

CREATE POLICY "Organization staff can read story CTA defaults"
ON public.content_story_cta_defaults
FOR SELECT TO authenticated
USING (public.is_user_in_organization(auth.uid(), organization_id));

REVOKE ALL ON public.content_story_cta_defaults FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_story_cta_defaults TO authenticated;
GRANT ALL ON public.content_story_cta_defaults TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_story(p_slug text, p_content_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_org_id uuid;
  v_story public.content_stories%ROWTYPE;
  v_video jsonb;
  v_analysis jsonb;
  v_blocks jsonb;
  v_cta jsonb;
  v_related jsonb;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = p_slug;
  IF v_org_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_story FROM public.content_stories
  WHERE organization_id = v_org_id AND status = 'published'
    AND (id = p_content_id OR source_video_id = p_content_id)
  LIMIT 1;

  SELECT to_jsonb(v) INTO v_video FROM (
    SELECT id, youtube_id, title, channel_name, thumbnail_url, duration_seconds, description, short_description, published_at
    FROM public.content_videos
    WHERE id = COALESCE(v_story.source_video_id, p_content_id)
      AND organization_id = v_org_id AND consent_level = 'public_search' AND ingest_status = 'ready'
  ) v;
  IF v_story.id IS NULL AND v_video IS NULL THEN RETURN NULL; END IF;

  SELECT to_jsonb(a) INTO v_analysis FROM (
    SELECT summary, themes, story_patterns, key_quotes, impact_score FROM public.content_analyses
    WHERE video_id = COALESCE(v_story.source_video_id, p_content_id) ORDER BY generated_at DESC LIMIT 1
  ) a;

  IF v_story.id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.sort_order), '[]'::jsonb) INTO v_blocks
    FROM public.content_story_blocks b WHERE b.story_id = v_story.id;
    SELECT to_jsonb(c) INTO v_cta FROM (
      SELECT CASE WHEN v_story.cta_mode = 'custom' THEN v_story.cta_headline ELSE d.headline END AS headline,
        CASE WHEN v_story.cta_mode = 'custom' THEN v_story.cta_description ELSE d.description END AS description,
        CASE WHEN v_story.cta_mode = 'custom' THEN v_story.cta_button_label ELSE d.button_label END AS button_label,
        CASE WHEN v_story.cta_mode = 'custom' THEN v_story.cta_url ELSE d.destination_url END AS destination_url
      FROM (SELECT 1) x LEFT JOIN public.content_story_cta_defaults d
        ON d.organization_id = v_org_id AND lower(d.category) = lower(v_story.category)
    ) c WHERE c.headline IS NOT NULL AND c.button_label IS NOT NULL AND c.destination_url IS NOT NULL;
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_related FROM (
      SELECT s.id, s.source_video_id, s.title, s.person_name, s.summary, s.category, s.story_format, s.lead_media_url,
        cv.thumbnail_url, cv.youtube_id, cv.duration_seconds
      FROM public.content_stories s LEFT JOIN public.content_videos cv ON cv.id = s.source_video_id
      WHERE s.organization_id = v_org_id AND s.status = 'published' AND s.id <> v_story.id
      ORDER BY CASE WHEN s.category IS NOT NULL AND lower(s.category) = lower(v_story.category) THEN 0 ELSE 1 END,
        s.published_at DESC NULLS LAST LIMIT 4
    ) r;
  ELSE
    v_blocks := '[]'::jsonb; v_cta := NULL;
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_related FROM (
      SELECT cv.id, cv.id AS source_video_id, cv.title, cv.channel_name AS person_name, cv.short_description AS summary,
        NULL::text AS category, 'vertical_video'::text AS story_format, cv.thumbnail_url AS lead_media_url,
        cv.thumbnail_url, cv.youtube_id, cv.duration_seconds
      FROM public.content_videos cv
      WHERE cv.organization_id = v_org_id AND cv.consent_level = 'public_search' AND cv.ingest_status = 'ready' AND cv.id <> p_content_id
      ORDER BY cv.is_featured DESC, cv.created_at DESC LIMIT 4
    ) r;
  END IF;

  RETURN jsonb_build_object('story', CASE WHEN v_story.id IS NULL THEN NULL ELSE to_jsonb(v_story) END,
    'video', v_video, 'analysis', v_analysis, 'blocks', COALESCE(v_blocks, '[]'::jsonb),
    'cta', v_cta, 'related', COALESCE(v_related, '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_story(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_story(text, uuid) TO anon, authenticated, service_role;
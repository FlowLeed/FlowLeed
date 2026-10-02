ALTER TABLE public.content_story_cta_defaults
  ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS destination_type text NOT NULL DEFAULT 'url',
  ADD COLUMN IF NOT EXISTS form_id uuid REFERENCES public.forms(id) ON DELETE SET NULL;
ALTER TABLE public.content_story_cta_defaults ALTER COLUMN destination_url DROP NOT NULL;
ALTER TABLE public.content_story_cta_defaults ALTER COLUMN description DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS content_story_cta_defaults_one_global ON public.content_story_cta_defaults(organization_id) WHERE is_global;

ALTER TABLE public.content_stories
  ADD COLUMN IF NOT EXISTS cta_preset_id uuid REFERENCES public.content_story_cta_defaults(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Public can read defaults used by published stories" ON public.content_story_cta_defaults;
CREATE POLICY "Public can read next steps of churches with published stories" ON public.content_story_cta_defaults
  FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.content_stories s WHERE s.organization_id = content_story_cta_defaults.organization_id AND s.status = 'published'));

CREATE OR REPLACE FUNCTION public.get_public_story(p_slug text, p_content_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid; v_story public.content_stories%ROWTYPE; v_video jsonb; v_analysis jsonb; v_blocks jsonb; v_cta jsonb; v_related jsonb;
  v_preset public.content_story_cta_defaults%ROWTYPE; v_url text;
BEGIN
  SELECT id INTO v_org_id FROM public.get_public_organization(p_slug) LIMIT 1;
  IF v_org_id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_story FROM public.content_stories WHERE organization_id = v_org_id AND status = 'published' AND (id = p_content_id OR source_video_id = p_content_id) LIMIT 1;
  SELECT to_jsonb(v) INTO v_video FROM (SELECT id, youtube_id, title, channel_name, thumbnail_url, duration_seconds, description, short_description, published_at FROM public.content_videos WHERE id = COALESCE(v_story.source_video_id, p_content_id) AND organization_id = v_org_id AND consent_level = 'public_search' AND ingest_status = 'ready') v;
  IF v_story.id IS NULL AND v_video IS NULL THEN RETURN NULL; END IF;
  SELECT to_jsonb(a) INTO v_analysis FROM (SELECT summary, themes, story_patterns, key_quotes, impact_score FROM public.content_analyses WHERE video_id = COALESCE(v_story.source_video_id, p_content_id) ORDER BY generated_at DESC LIMIT 1) a;

  IF v_story.id IS NOT NULL AND v_story.cta_mode = 'custom' AND v_story.cta_headline IS NOT NULL AND v_story.cta_button_label IS NOT NULL AND v_story.cta_url IS NOT NULL THEN
    v_cta := jsonb_build_object('headline', v_story.cta_headline, 'description', v_story.cta_description, 'button_label', v_story.cta_button_label, 'destination_url', v_story.cta_url);
  ELSE
    IF v_story.id IS NOT NULL AND v_story.cta_mode = 'preset' AND v_story.cta_preset_id IS NOT NULL THEN
      SELECT * INTO v_preset FROM public.content_story_cta_defaults WHERE id = v_story.cta_preset_id AND organization_id = v_org_id;
    END IF;
    IF v_preset.id IS NULL AND v_story.category IS NOT NULL THEN
      SELECT * INTO v_preset FROM public.content_story_cta_defaults WHERE organization_id = v_org_id AND NOT is_global AND lower(category) = lower(v_story.category) LIMIT 1;
    END IF;
    IF v_preset.id IS NULL THEN
      SELECT * INTO v_preset FROM public.content_story_cta_defaults WHERE organization_id = v_org_id AND is_global LIMIT 1;
    END IF;
    IF v_preset.id IS NOT NULL THEN
      IF v_preset.destination_type = 'form' THEN
        SELECT '/' || p_slug || '/f/' || f.slug INTO v_url FROM public.forms f WHERE f.id = v_preset.form_id AND f.organization_id = v_org_id AND f.is_published;
      ELSE v_url := v_preset.destination_url; END IF;
      IF v_url IS NOT NULL AND v_preset.headline IS NOT NULL AND v_preset.button_label IS NOT NULL THEN
        v_cta := jsonb_build_object('headline', v_preset.headline, 'description', v_preset.description, 'button_label', v_preset.button_label, 'destination_url', v_url);
      END IF;
    END IF;
  END IF;

  IF v_story.id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.sort_order), '[]'::jsonb) INTO v_blocks FROM public.content_story_blocks b WHERE b.story_id = v_story.id;
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_related FROM (SELECT s.id, s.source_video_id, s.title, s.person_name, s.summary, s.category, s.story_format, s.lead_media_url, cv.thumbnail_url, cv.youtube_id, cv.duration_seconds FROM public.content_stories s LEFT JOIN public.content_videos cv ON cv.id = s.source_video_id WHERE s.organization_id = v_org_id AND s.status = 'published' AND s.id <> v_story.id ORDER BY CASE WHEN s.category IS NOT NULL AND lower(s.category) = lower(v_story.category) THEN 0 ELSE 1 END, s.published_at DESC NULLS LAST LIMIT 4) r;
  ELSE
    v_blocks := '[]'::jsonb;
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_related FROM (SELECT cv.id, cv.id AS source_video_id, cv.title, cv.channel_name AS person_name, cv.short_description AS summary, NULL::text AS category, 'vertical_video'::text AS story_format, cv.thumbnail_url AS lead_media_url, cv.thumbnail_url, cv.youtube_id, cv.duration_seconds FROM public.content_videos cv WHERE cv.organization_id = v_org_id AND cv.consent_level = 'public_search' AND cv.ingest_status = 'ready' AND cv.id <> p_content_id ORDER BY cv.is_featured DESC, cv.created_at DESC LIMIT 4) r;
  END IF;
  RETURN jsonb_build_object('story', CASE WHEN v_story.id IS NULL THEN NULL ELSE to_jsonb(v_story) END, 'video', v_video, 'analysis', v_analysis, 'blocks', COALESCE(v_blocks, '[]'::jsonb), 'cta', v_cta, 'related', COALESCE(v_related, '[]'::jsonb));
END;
$function$;
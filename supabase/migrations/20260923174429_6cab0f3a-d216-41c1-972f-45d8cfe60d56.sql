CREATE TABLE public.content_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_video_id uuid UNIQUE REFERENCES public.content_videos(id) ON DELETE SET NULL,
  title text NOT NULL,
  person_name text,
  summary text,
  category text,
  story_format text NOT NULL DEFAULT 'vertical_video',
  lead_media_url text,
  lead_media_alt text,
  reading_time_minutes integer,
  status text NOT NULL DEFAULT 'draft',
  cta_mode text NOT NULL DEFAULT 'category_default',
  cta_headline text,
  cta_description text,
  cta_button_label text,
  cta_url text,
  created_by uuid,
  updated_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.content_stories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_stories TO authenticated;
GRANT ALL ON public.content_stories TO service_role;
ALTER TABLE public.content_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_stories public can view published" ON public.content_stories FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "content_stories authenticated can view" ON public.content_stories FOR SELECT TO authenticated USING (status = 'published' OR public.get_user_organization_role(auth.uid(), organization_id) IS NOT NULL OR public.is_system_admin(auth.uid()));
CREATE POLICY "content_stories admins can create" ON public.content_stories FOR INSERT TO authenticated WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin') OR public.is_system_admin(auth.uid()));
CREATE POLICY "content_stories admins can update" ON public.content_stories FOR UPDATE TO authenticated USING (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin') OR public.is_system_admin(auth.uid())) WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin') OR public.is_system_admin(auth.uid()));
CREATE POLICY "content_stories admins can delete" ON public.content_stories FOR DELETE TO authenticated USING (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin') OR public.is_system_admin(auth.uid()));
CREATE INDEX content_stories_org_status_idx ON public.content_stories(organization_id, status, published_at DESC);
CREATE INDEX content_stories_category_idx ON public.content_stories(organization_id, category) WHERE status = 'published';

CREATE TABLE public.content_story_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.content_stories(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  block_type text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  heading text,
  body text,
  quote_attribution text,
  media_url text,
  media_alt text,
  caption text,
  video_id text,
  video_orientation text,
  gallery_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.content_story_blocks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_story_blocks TO authenticated;
GRANT ALL ON public.content_story_blocks TO service_role;
ALTER TABLE public.content_story_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_story_blocks public can view published" ON public.content_story_blocks FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.content_stories s WHERE s.id = story_id AND s.status = 'published'));
CREATE POLICY "content_story_blocks authenticated can view" ON public.content_story_blocks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.content_stories s WHERE s.id = story_id AND (s.status = 'published' OR public.get_user_organization_role(auth.uid(), s.organization_id) IS NOT NULL OR public.is_system_admin(auth.uid()))));
CREATE POLICY "content_story_blocks admins can create" ON public.content_story_blocks FOR INSERT TO authenticated WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin') OR public.is_system_admin(auth.uid()));
CREATE POLICY "content_story_blocks admins can update" ON public.content_story_blocks FOR UPDATE TO authenticated USING (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin') OR public.is_system_admin(auth.uid())) WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin') OR public.is_system_admin(auth.uid()));
CREATE POLICY "content_story_blocks admins can delete" ON public.content_story_blocks FOR DELETE TO authenticated USING (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin') OR public.is_system_admin(auth.uid()));
CREATE INDEX content_story_blocks_story_order_idx ON public.content_story_blocks(story_id, sort_order);

CREATE TABLE public.content_story_cta_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category text NOT NULL,
  headline text NOT NULL,
  description text NOT NULL,
  button_label text NOT NULL,
  destination_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, category)
);
GRANT SELECT ON public.content_story_cta_defaults TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_story_cta_defaults TO authenticated;
GRANT ALL ON public.content_story_cta_defaults TO service_role;
ALTER TABLE public.content_story_cta_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_story_cta_defaults public can view" ON public.content_story_cta_defaults FOR SELECT TO anon USING (true);
CREATE POLICY "content_story_cta_defaults authenticated can view" ON public.content_story_cta_defaults FOR SELECT TO authenticated USING (true);
CREATE POLICY "content_story_cta_defaults admins can create" ON public.content_story_cta_defaults FOR INSERT TO authenticated WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin') OR public.is_system_admin(auth.uid()));
CREATE POLICY "content_story_cta_defaults admins can update" ON public.content_story_cta_defaults FOR UPDATE TO authenticated USING (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin') OR public.is_system_admin(auth.uid())) WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin') OR public.is_system_admin(auth.uid()));
CREATE POLICY "content_story_cta_defaults admins can delete" ON public.content_story_cta_defaults FOR DELETE TO authenticated USING (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin') OR public.is_system_admin(auth.uid()));

CREATE TRIGGER content_stories_updated_at BEFORE UPDATE ON public.content_stories FOR EACH ROW EXECUTE FUNCTION public.content_set_updated_at();
CREATE TRIGGER content_story_blocks_updated_at BEFORE UPDATE ON public.content_story_blocks FOR EACH ROW EXECUTE FUNCTION public.content_set_updated_at();
CREATE TRIGGER content_story_cta_defaults_updated_at BEFORE UPDATE ON public.content_story_cta_defaults FOR EACH ROW EXECUTE FUNCTION public.content_set_updated_at();

CREATE POLICY "story media public read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'story-media');
CREATE POLICY "story media org admins upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'story-media' AND public.get_user_organization_role(auth.uid(), ((storage.foldername(name))[1])::uuid) IN ('owner','admin'));
CREATE POLICY "story media org admins update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'story-media' AND public.get_user_organization_role(auth.uid(), ((storage.foldername(name))[1])::uuid) IN ('owner','admin')) WITH CHECK (bucket_id = 'story-media' AND public.get_user_organization_role(auth.uid(), ((storage.foldername(name))[1])::uuid) IN ('owner','admin'));
CREATE POLICY "story media org admins delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'story-media' AND public.get_user_organization_role(auth.uid(), ((storage.foldername(name))[1])::uuid) IN ('owner','admin'));

CREATE OR REPLACE FUNCTION public.get_public_story(p_slug text, p_content_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT * INTO v_story
  FROM public.content_stories
  WHERE organization_id = v_org_id
    AND status = 'published'
    AND (id = p_content_id OR source_video_id = p_content_id)
  LIMIT 1;

  SELECT to_jsonb(v) INTO v_video
  FROM (
    SELECT id, youtube_id, title, channel_name, thumbnail_url, duration_seconds, description, short_description, published_at
    FROM public.content_videos
    WHERE id = COALESCE(v_story.source_video_id, p_content_id)
      AND organization_id = v_org_id
      AND consent_level = 'public_search'
      AND ingest_status = 'ready'
  ) v;

  IF v_story.id IS NULL AND v_video IS NULL THEN RETURN NULL; END IF;

  SELECT to_jsonb(a) INTO v_analysis
  FROM (
    SELECT summary, themes, story_patterns, key_quotes, impact_score
    FROM public.content_analyses
    WHERE video_id = COALESCE(v_story.source_video_id, p_content_id)
    ORDER BY generated_at DESC LIMIT 1
  ) a;

  IF v_story.id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.sort_order), '[]'::jsonb) INTO v_blocks
    FROM public.content_story_blocks b WHERE b.story_id = v_story.id;

    SELECT to_jsonb(c) INTO v_cta
    FROM (
      SELECT
        CASE WHEN v_story.cta_mode = 'custom' THEN v_story.cta_headline ELSE d.headline END AS headline,
        CASE WHEN v_story.cta_mode = 'custom' THEN v_story.cta_description ELSE d.description END AS description,
        CASE WHEN v_story.cta_mode = 'custom' THEN v_story.cta_button_label ELSE d.button_label END AS button_label,
        CASE WHEN v_story.cta_mode = 'custom' THEN v_story.cta_url ELSE d.destination_url END AS destination_url
      FROM (SELECT 1) x
      LEFT JOIN public.content_story_cta_defaults d ON d.organization_id = v_org_id AND lower(d.category) = lower(v_story.category)
    ) c
    WHERE c.headline IS NOT NULL AND c.button_label IS NOT NULL AND c.destination_url IS NOT NULL;

    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_related
    FROM (
      SELECT s.id, s.source_video_id, s.title, s.person_name, s.summary, s.category, s.story_format, s.lead_media_url,
             cv.thumbnail_url, cv.youtube_id, cv.duration_seconds
      FROM public.content_stories s
      LEFT JOIN public.content_videos cv ON cv.id = s.source_video_id
      LEFT JOIN LATERAL (
        SELECT themes FROM public.content_analyses ca WHERE ca.video_id = s.source_video_id ORDER BY ca.generated_at DESC LIMIT 1
      ) sa ON true
      WHERE s.organization_id = v_org_id AND s.status = 'published' AND s.id <> v_story.id
      ORDER BY
        CASE WHEN s.category IS NOT NULL AND lower(s.category) = lower(v_story.category) THEN 0 ELSE 1 END,
        (SELECT count(*) FROM unnest(COALESCE(sa.themes, '{}'::text[])) t WHERE t = ANY(COALESCE((SELECT themes FROM public.content_analyses WHERE video_id = v_story.source_video_id ORDER BY generated_at DESC LIMIT 1), '{}'::text[]))) DESC,
        s.published_at DESC NULLS LAST
      LIMIT 4
    ) r;
  ELSE
    v_blocks := '[]'::jsonb;
    v_cta := NULL;
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_related
    FROM (
      SELECT cv.id, cv.id AS source_video_id, cv.title, cv.channel_name AS person_name, cv.short_description AS summary,
             NULL::text AS category, 'vertical_video'::text AS story_format, cv.thumbnail_url AS lead_media_url,
             cv.thumbnail_url, cv.youtube_id, cv.duration_seconds
      FROM public.content_videos cv
      WHERE cv.organization_id = v_org_id AND cv.consent_level = 'public_search' AND cv.ingest_status = 'ready' AND cv.id <> p_content_id
      ORDER BY cv.is_featured DESC, cv.created_at DESC LIMIT 4
    ) r;
  END IF;

  RETURN jsonb_build_object(
    'story', CASE WHEN v_story.id IS NULL THEN NULL ELSE to_jsonb(v_story) END,
    'video', v_video,
    'analysis', v_analysis,
    'blocks', COALESCE(v_blocks, '[]'::jsonb),
    'cta', v_cta,
    'related', COALESCE(v_related, '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_story(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_story(text, uuid) TO anon, authenticated, service_role;
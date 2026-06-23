CREATE OR REPLACE FUNCTION public.get_public_content_video(p_slug text, p_video_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_video jsonb;
  v_analysis jsonb;
  v_chunks jsonb;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = p_slug;
  IF v_org_id IS NULL THEN RETURN NULL; END IF;

  SELECT to_jsonb(v) INTO v_video
  FROM (
    SELECT id, youtube_id, title, channel_name, thumbnail_url, duration_seconds, description, short_description, published_at
    FROM content_videos
    WHERE id = p_video_id
      AND organization_id = v_org_id
      AND consent_level = 'public_search'
      AND ingest_status = 'ready'
  ) v;
  IF v_video IS NULL THEN RETURN NULL; END IF;

  SELECT to_jsonb(a) INTO v_analysis
  FROM (
    SELECT summary, themes, story_patterns, key_quotes, impact_score, generated_at
    FROM content_analyses
    WHERE video_id = p_video_id
    ORDER BY generated_at DESC
    LIMIT 1
  ) a;

  SELECT jsonb_agg(to_jsonb(c) ORDER BY (c).chunk_index) INTO v_chunks
  FROM (
    SELECT id, chunk_index, text, start_seconds, end_seconds
    FROM content_transcript_chunks
    WHERE video_id = p_video_id
  ) c;

  RETURN jsonb_build_object(
    'video', v_video,
    'analysis', v_analysis,
    'chunks', COALESCE(v_chunks, '[]'::jsonb)
  );
END;
$function$;
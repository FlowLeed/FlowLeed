CREATE OR REPLACE FUNCTION public.match_content_chunks(query_embedding vector, p_org_id uuid, p_video_id uuid DEFAULT NULL::uuid, match_threshold double precision DEFAULT 0.3, match_count integer DEFAULT 8)
 RETURNS TABLE(chunk_id uuid, video_id uuid, chunk_index integer, text text, start_seconds integer, end_seconds integer, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.id,
    c.video_id,
    c.chunk_index,
    c.text,
    c.start_seconds,
    c.end_seconds,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.content_transcript_chunks c
  WHERE c.organization_id = p_org_id
    AND (p_video_id IS NULL OR c.video_id = p_video_id)
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
    AND (
      auth.uid() IS NULL
      OR public.get_user_organization_role(auth.uid(), c.organization_id) IS NOT NULL
      OR public.is_system_admin(auth.uid())
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$function$;
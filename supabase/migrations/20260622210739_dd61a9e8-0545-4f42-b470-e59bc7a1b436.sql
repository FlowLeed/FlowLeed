
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.content_consent_level AS ENUM ('internal_use', 'public_search');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.content_ingest_status AS ENUM ('pending','transcribing','embedding','analyzing','ready','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: updated_at trigger
CREATE OR REPLACE FUNCTION public.content_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ content_videos ============
CREATE TABLE IF NOT EXISTS public.content_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  youtube_id text NOT NULL,
  url text NOT NULL,
  title text,
  channel_name text,
  channel_id text,
  description text,
  thumbnail_url text,
  duration_seconds integer,
  published_at timestamptz,
  consent_level public.content_consent_level NOT NULL DEFAULT 'internal_use',
  ingest_status public.content_ingest_status NOT NULL DEFAULT 'pending',
  error_message text,
  ingested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, youtube_id)
);

GRANT SELECT ON public.content_videos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_videos TO authenticated;
GRANT ALL ON public.content_videos TO service_role;

ALTER TABLE public.content_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_videos: org members can view"
  ON public.content_videos FOR SELECT
  USING (
    public.get_user_organization_role(auth.uid(), organization_id) IS NOT NULL
    OR public.is_system_admin(auth.uid())
  );

CREATE POLICY "content_videos: public_search readable by anon"
  ON public.content_videos FOR SELECT
  TO anon
  USING (consent_level = 'public_search');

CREATE POLICY "content_videos: public_search readable by authenticated"
  ON public.content_videos FOR SELECT
  TO authenticated
  USING (consent_level = 'public_search');

CREATE POLICY "content_videos: org members can insert"
  ON public.content_videos FOR INSERT
  WITH CHECK (
    public.get_user_organization_role(auth.uid(), organization_id) IS NOT NULL
  );

CREATE POLICY "content_videos: org members can update"
  ON public.content_videos FOR UPDATE
  USING (public.get_user_organization_role(auth.uid(), organization_id) IS NOT NULL)
  WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IS NOT NULL);

CREATE POLICY "content_videos: org admins can delete"
  ON public.content_videos FOR DELETE
  USING (
    public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin')
    OR public.is_system_admin(auth.uid())
  );

CREATE TRIGGER trg_content_videos_updated_at
  BEFORE UPDATE ON public.content_videos
  FOR EACH ROW EXECUTE FUNCTION public.content_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_content_videos_org ON public.content_videos(organization_id);
CREATE INDEX IF NOT EXISTS idx_content_videos_public ON public.content_videos(consent_level) WHERE consent_level = 'public_search';

-- ============ content_transcript_chunks ============
CREATE TABLE IF NOT EXISTS public.content_transcript_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.content_videos(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  text text NOT NULL,
  start_seconds integer NOT NULL DEFAULT 0,
  end_seconds integer NOT NULL DEFAULT 0,
  embedding vector(384),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_id, chunk_index)
);

GRANT SELECT ON public.content_transcript_chunks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_transcript_chunks TO authenticated;
GRANT ALL ON public.content_transcript_chunks TO service_role;

ALTER TABLE public.content_transcript_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_chunks: org members can view"
  ON public.content_transcript_chunks FOR SELECT
  USING (
    public.get_user_organization_role(auth.uid(), organization_id) IS NOT NULL
    OR public.is_system_admin(auth.uid())
  );

CREATE POLICY "content_chunks: public via video consent (anon)"
  ON public.content_transcript_chunks FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM public.content_videos v
    WHERE v.id = video_id AND v.consent_level = 'public_search'
  ));

CREATE POLICY "content_chunks: public via video consent (auth)"
  ON public.content_transcript_chunks FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.content_videos v
    WHERE v.id = video_id AND v.consent_level = 'public_search'
  ));

CREATE POLICY "content_chunks: org members can write"
  ON public.content_transcript_chunks FOR ALL
  USING (public.get_user_organization_role(auth.uid(), organization_id) IS NOT NULL)
  WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_content_chunks_video ON public.content_transcript_chunks(video_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_content_chunks_org ON public.content_transcript_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_content_chunks_embedding
  ON public.content_transcript_chunks
  USING hnsw (embedding vector_cosine_ops);

-- ============ content_analyses ============
CREATE TABLE IF NOT EXISTS public.content_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.content_videos(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  summary text,
  themes text[] DEFAULT '{}',
  story_patterns jsonb DEFAULT '[]'::jsonb,
  key_quotes jsonb DEFAULT '[]'::jsonb,
  impact_score smallint,
  model text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.content_analyses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_analyses TO authenticated;
GRANT ALL ON public.content_analyses TO service_role;

ALTER TABLE public.content_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_analyses: org members view"
  ON public.content_analyses FOR SELECT
  USING (
    public.get_user_organization_role(auth.uid(), organization_id) IS NOT NULL
    OR public.is_system_admin(auth.uid())
  );

CREATE POLICY "content_analyses: public via video consent (anon)"
  ON public.content_analyses FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM public.content_videos v
    WHERE v.id = video_id AND v.consent_level = 'public_search'
  ));

CREATE POLICY "content_analyses: public via video consent (auth)"
  ON public.content_analyses FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.content_videos v
    WHERE v.id = video_id AND v.consent_level = 'public_search'
  ));

CREATE POLICY "content_analyses: org members write"
  ON public.content_analyses FOR ALL
  USING (public.get_user_organization_role(auth.uid(), organization_id) IS NOT NULL)
  WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_content_analyses_video ON public.content_analyses(video_id, generated_at DESC);

-- ============ content_chat_sessions ============
CREATE TABLE IF NOT EXISTS public.content_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  video_id uuid REFERENCES public.content_videos(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_chat_sessions TO authenticated;
GRANT ALL ON public.content_chat_sessions TO service_role;

ALTER TABLE public.content_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_chat_sessions: owner only"
  ON public.content_chat_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.get_user_organization_role(auth.uid(), organization_id) IS NOT NULL
  );

CREATE TRIGGER trg_content_chat_sessions_updated_at
  BEFORE UPDATE ON public.content_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.content_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_content_chat_sessions_user ON public.content_chat_sessions(user_id, updated_at DESC);

-- ============ content_chat_messages ============
CREATE TABLE IF NOT EXISTS public.content_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.content_chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  citations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_chat_messages TO authenticated;
GRANT ALL ON public.content_chat_messages TO service_role;

ALTER TABLE public.content_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_chat_messages: owner via session"
  ON public.content_chat_messages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.content_chat_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.content_chat_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_content_chat_messages_session ON public.content_chat_messages(session_id, created_at);

-- ============ RPC: match_content_chunks ============
CREATE OR REPLACE FUNCTION public.match_content_chunks(
  query_embedding vector(384),
  p_org_id uuid,
  p_video_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  chunk_id uuid,
  video_id uuid,
  chunk_index int,
  text text,
  start_seconds int,
  end_seconds int,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
      public.get_user_organization_role(auth.uid(), c.organization_id) IS NOT NULL
      OR public.is_system_admin(auth.uid())
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_content_chunks(vector, uuid, uuid, float, int) TO authenticated, service_role;

-- ============ RPC: match_content_chunks_public (org slug, only public videos) ============
CREATE OR REPLACE FUNCTION public.match_content_chunks_public(
  query_embedding vector(384),
  p_org_slug text,
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  chunk_id uuid,
  video_id uuid,
  chunk_index int,
  text text,
  start_seconds int,
  end_seconds int,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.video_id,
    c.chunk_index,
    c.text,
    c.start_seconds,
    c.end_seconds,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.content_transcript_chunks c
  JOIN public.content_videos v ON v.id = c.video_id
  JOIN public.organizations o ON o.id = v.organization_id
  WHERE o.slug = p_org_slug
    AND v.consent_level = 'public_search'
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_content_chunks_public(vector, text, float, int) TO anon, authenticated, service_role;

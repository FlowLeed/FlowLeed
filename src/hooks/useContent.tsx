import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";

export interface ContentVideo {
  id: string;
  organization_id: string;
  youtube_id: string;
  url: string;
  title: string | null;
  channel_name: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  consent_level: "internal_use" | "public_search";
  ingest_status: "pending" | "transcribing" | "embedding" | "analyzing" | "ready" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export const useContentVideos = () => {
  const { organization } = useProfile();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ["content-videos", orgId],
    queryFn: async () => {
      if (!orgId) return [] as ContentVideo[];
      const { data, error } = await supabase
        .from("content_videos" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ContentVideo[];
    },
    enabled: !!orgId,
    refetchInterval: (q) => {
      const list = (q.state.data ?? []) as ContentVideo[];
      return list.some((v) =>
        ["pending", "transcribing", "embedding", "analyzing"].includes(v.ingest_status),
      ) ? 4000 : false;
    },
  });
};

export const useContentVideo = (videoId: string | undefined) => {
  return useQuery({
    queryKey: ["content-video", videoId],
    queryFn: async () => {
      if (!videoId) return null;
      const { data, error } = await supabase
        .from("content_videos" as any)
        .select("*")
        .eq("id", videoId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ContentVideo | null;
    },
    enabled: !!videoId,
    refetchInterval: (q) => {
      const v = q.state.data as ContentVideo | null | undefined;
      return v && ["pending", "transcribing", "embedding", "analyzing"].includes(v.ingest_status)
        ? 3000 : false;
    },
  });
};

export interface ContentAnalysis {
  id: string;
  video_id: string;
  summary: string | null;
  themes: string[];
  story_patterns: Array<{ name: string; description: string }>;
  key_quotes: Array<{ text: string; start_seconds: number; impact_score: number }>;
  impact_score: number | null;
  generated_at: string;
}

export const useContentAnalysis = (videoId: string | undefined) => {
  return useQuery({
    queryKey: ["content-analysis", videoId],
    queryFn: async () => {
      if (!videoId) return null;
      const { data, error } = await supabase
        .from("content_analyses" as any)
        .select("*")
        .eq("video_id", videoId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ContentAnalysis | null;
    },
    enabled: !!videoId,
  });
};

export interface ContentChunk {
  id: string;
  video_id: string;
  chunk_index: number;
  text: string;
  start_seconds: number;
  end_seconds: number;
}

export const useContentChunks = (videoId: string | undefined) => {
  return useQuery({
    queryKey: ["content-chunks", videoId],
    queryFn: async () => {
      if (!videoId) return [] as ContentChunk[];
      const { data, error } = await supabase
        .from("content_transcript_chunks" as any)
        .select("id, video_id, chunk_index, text, start_seconds, end_seconds")
        .eq("video_id", videoId)
        .order("chunk_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ContentChunk[];
    },
    enabled: !!videoId,
  });
};

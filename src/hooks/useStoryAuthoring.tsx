import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StoryBlock, StoryRecord } from "@/lib/storyTypes";

export function useStoryAuthoring(videoId?: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["content-story", videoId],
    enabled: Boolean(videoId),
    queryFn: async () => {
      const { data: story, error } = await supabase.from("content_stories" as never).select("*").eq("source_video_id", videoId ?? "").maybeSingle();
      if (error) throw error;
      if (!story) return { story: null as StoryRecord | null, blocks: [] as StoryBlock[] };
      const typedStory = story as unknown as StoryRecord;
      const { data: blocks, error: blocksError } = await supabase.from("content_story_blocks" as never).select("*").eq("story_id", typedStory.id).order("sort_order");
      if (blocksError) throw blocksError;
      return { story: typedStory, blocks: (blocks ?? []) as unknown as StoryBlock[] };
    },
  });

  const save = useMutation({
    mutationFn: async ({ story, blocks }: { story: Partial<StoryRecord> & Pick<StoryRecord, "organization_id" | "source_video_id" | "title">; blocks: Array<Partial<StoryBlock>> }) => {
      const payload = { ...story, published_at: story.status === "published" ? (story.published_at ?? new Date().toISOString()) : null };
      const { data, error } = await supabase.from("content_stories" as never).upsert(payload as never, { onConflict: "source_video_id" }).select("*").single();
      if (error) throw error;
      const saved = data as unknown as StoryRecord;
      const { error: deleteError } = await supabase.from("content_story_blocks" as never).delete().eq("story_id", saved.id);
      if (deleteError) throw deleteError;
      let savedBlocks: StoryBlock[] = [];
      if (blocks.length) {
        const rows = blocks.map((block, index) => ({
          story_id: saved.id,
          organization_id: saved.organization_id,
          block_type: block.block_type ?? "paragraph",
          sort_order: index,
          heading: block.heading ?? null,
          body: block.body ?? null,
          quote_attribution: block.quote_attribution ?? null,
          media_url: block.media_url ?? null,
          media_alt: block.media_alt ?? null,
          caption: block.caption ?? null,
          video_id: block.video_id ?? null,
          video_orientation: block.video_orientation ?? null,
          gallery_items: block.gallery_items ?? [],
        }));
        const { data: inserted, error: insertError } = await supabase.from("content_story_blocks" as never).insert(rows as never).select("*");
        if (insertError) throw insertError;
        savedBlocks = (inserted ?? []) as unknown as StoryBlock[];
      }
      return { story: saved, blocks: savedBlocks };
    },
    onSuccess: (savedData) => {
      queryClient.setQueryData(["content-story", videoId], savedData);
    },
  });

  return { ...query, save };
}

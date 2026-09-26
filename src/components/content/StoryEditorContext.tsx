import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useStoryAuthoring } from "@/hooks/useStoryAuthoring";
import { resolvePreset, useNextSteps } from "@/hooks/useNextSteps";
import type { EditableBlock } from "./StoryBlockCanvas";
import { CTA_SUGGESTIONS, type StoryFormat, type StoryRecord } from "@/lib/storyTypes";

type VideoSource = { id: string; organization_id: string; title: string | null; channel_name: string | null; short_description: string | null; thumbnail_url: string | null; youtube_id: string; video_orientation?: string | null };
type AnalysisSource = { summary?: string | null; themes?: string[] | null; key_quotes?: Array<{ text: string }> | null } | null;

interface StoryEditorValue {
  isLoading: boolean;
  isPublic: boolean;
  organizationSlug: string | null;
  videoId: string;
  organizationId: string;
  format: StoryFormat;
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  personName: string;
  setPersonName: Dispatch<SetStateAction<string>>;
  summary: string;
  setSummary: Dispatch<SetStateAction<string>>;
  leadMediaUrl: string;
  uploading: boolean;
  uploadLead: (file: File) => Promise<void>;
  blocks: EditableBlock[];
  setBlocks: Dispatch<SetStateAction<EditableBlock[]>>;
  category: string;
  setCategory: Dispatch<SetStateAction<string>>;
  ctaMode: "category_default" | "preset" | "custom";
  setCtaMode: Dispatch<SetStateAction<"category_default" | "preset" | "custom">>;
  ctaPresetId: string | null;
  setCtaPresetId: Dispatch<SetStateAction<string | null>>;
  managerOpen: boolean;
  setManagerOpen: Dispatch<SetStateAction<boolean>>;
  ctaHeadline: string;
  setCtaHeadline: Dispatch<SetStateAction<string>>;
  ctaDescription: string;
  setCtaDescription: Dispatch<SetStateAction<string>>;
  ctaLabel: string;
  setCtaLabel: Dispatch<SetStateAction<string>>;
  ctaUrl: string;
  setCtaUrl: Dispatch<SetStateAction<string>>;
  nextSteps: ReturnType<typeof useNextSteps>;
  resolvedPreset: ReturnType<typeof resolvePreset>;
  suggested: { headline: string; description: string; button: string };
  saveStory: () => Promise<void>;
  savePending: boolean;
  hasTitle: boolean;
}

const StoryEditorContext = createContext<StoryEditorValue | null>(null);

export function useStoryEditor(): StoryEditorValue {
  const value = useContext(StoryEditorContext);
  if (!value) throw new Error("useStoryEditor must be used inside StoryEditorProvider");
  return value;
}

export function StoryEditorProvider({ video, analysis, isPublic, children }: { video: VideoSource; analysis: AnalysisSource; isPublic: boolean; children: ReactNode }) {
  const { data, isLoading, save } = useStoryAuthoring(video.id);
  const { toast } = useToast();
  const { organization } = useProfile();
  const uploadRef = { current: null as HTMLInputElement | null };
  void uploadRef;
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState(video.title ?? "");
  const [personName, setPersonName] = useState(video.channel_name ?? "");
  const [summary, setSummary] = useState(video.short_description ?? analysis?.summary ?? "");
  const [category, setCategory] = useState(analysis?.themes?.[0] ?? "");
  // Layout follows the video itself: vertical video → vertical layout, otherwise horizontal.
  const format: StoryFormat = video.video_orientation === "vertical" ? "vertical_video" : "horizontal_video";
  const [leadMediaUrl, setLeadMediaUrl] = useState(video.thumbnail_url ?? "");
  const [ctaMode, setCtaMode] = useState<"category_default" | "preset" | "custom">("category_default");
  const [ctaPresetId, setCtaPresetId] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const nextSteps = useNextSteps(video.organization_id);
  const [ctaHeadline, setCtaHeadline] = useState("");
  const [ctaDescription, setCtaDescription] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [blocks, setBlocks] = useState<EditableBlock[]>([]);

  useEffect(() => {
    if (!data?.story) return;
    const story = data.story;
    setTitle(story.title); setPersonName(story.person_name ?? ""); setSummary(story.summary ?? ""); setCategory(story.category ?? "");
    setLeadMediaUrl(story.lead_media_url ?? ""); setCtaMode(story.cta_mode); setCtaPresetId(story.cta_preset_id ?? null);
    setCtaHeadline(story.cta_headline ?? ""); setCtaDescription(story.cta_description ?? ""); setCtaLabel(story.cta_button_label ?? ""); setCtaUrl(story.cta_url ?? "");
    setBlocks(data.blocks.map((block) => ({ ...block, clientId: block.id })));
  }, [data]);

  const suggested = useMemo(() => {
    const haystack = `${category} ${(analysis?.themes ?? []).join(" ")}`.toLowerCase();
    const key = Object.keys(CTA_SUGGESTIONS).find((candidate) => haystack.includes(candidate));
    return key ? CTA_SUGGESTIONS[key as keyof typeof CTA_SUGGESTIONS] : CTA_SUGGESTIONS.community;
  }, [category, analysis?.themes]);

  const uploadLead = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${video.organization_id}/${video.id}/lead-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("story-media").upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data: publicUrl } = supabase.storage.from("story-media").getPublicUrl(path);
      setLeadMediaUrl(publicUrl.publicUrl);
      toast({ title: "Story image uploaded" });
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setUploading(false); }
  };

  const status: "draft" | "published" = isPublic ? "published" : "draft";

  const saveStory = async () => {
    if (!title.trim()) return;
    const story: Partial<StoryRecord> & Pick<StoryRecord, "organization_id" | "source_video_id" | "title"> = {
      organization_id: video.organization_id, source_video_id: video.id, title: title.trim(), person_name: personName.trim() || null,
      summary: summary.trim() || null, category: category.trim() || null, story_format: format, lead_media_url: leadMediaUrl || null,
      lead_media_alt: personName.trim() ? `${personName.trim()} story` : title.trim(), status, cta_mode: ctaMode, cta_preset_id: ctaMode === "preset" ? ctaPresetId : null,
      cta_headline: ctaMode === "custom" ? ctaHeadline.trim() || null : null,
      cta_description: ctaMode === "custom" ? ctaDescription.trim() || null : null,
      cta_button_label: ctaMode === "custom" ? ctaLabel.trim() || null : null,
      cta_url: ctaMode === "custom" ? ctaUrl.trim() || null : null,
    };
    try { await save.mutateAsync({ story, blocks }); toast({ title: "Story saved" }); }
    catch (error) { toast({ title: "Story not saved", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
  };

  const resolvedPreset = useMemo(() => resolvePreset(nextSteps.presets, ctaMode, ctaPresetId, category), [nextSteps.presets, ctaMode, ctaPresetId, category]);

  const value: StoryEditorValue = {
    isLoading, isPublic, organizationSlug: organization?.slug ?? null, videoId: video.id, organizationId: video.organization_id, format,
    title, setTitle, personName, setPersonName, summary, setSummary, leadMediaUrl, uploading, uploadLead, blocks, setBlocks,
    category, setCategory, ctaMode, setCtaMode, ctaPresetId, setCtaPresetId, managerOpen, setManagerOpen,
    ctaHeadline, setCtaHeadline, ctaDescription, setCtaDescription, ctaLabel, setCtaLabel, ctaUrl, setCtaUrl,
    nextSteps, resolvedPreset, suggested, saveStory, savePending: save.isPending, hasTitle: !!title.trim(),
  };

  return <StoryEditorContext.Provider value={value}>{children}</StoryEditorContext.Provider>;
}

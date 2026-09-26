export type StoryFormat = "horizontal_video" | "vertical_video" | "written" | "mixed";
export type StoryStatus = "draft" | "published";
export type StoryBlockType = "heading" | "paragraph" | "quote" | "image" | "gallery" | "video";

export interface StoryRecord {
  id: string;
  organization_id: string;
  source_video_id: string | null;
  title: string;
  person_name: string | null;
  summary: string | null;
  category: string | null;
  story_format: StoryFormat;
  lead_media_url: string | null;
  lead_media_alt: string | null;
  reading_time_minutes: number | null;
  status: StoryStatus;
  cta_mode: "category_default" | "preset" | "custom" | "none";
  cta_preset_id: string | null;
  cta_headline: string | null;
  cta_description: string | null;
  cta_button_label: string | null;
  cta_url: string | null;
  published_at: string | null;
}

export interface StoryBlock {
  id: string;
  story_id: string;
  organization_id: string;
  block_type: StoryBlockType;
  sort_order: number;
  heading: string | null;
  body: string | null;
  quote_attribution: string | null;
  media_url: string | null;
  media_alt: string | null;
  caption: string | null;
  video_id: string | null;
  video_orientation: "horizontal" | "vertical" | null;
  gallery_items: Array<{ url: string; alt?: string; caption?: string }>;
}

export interface StoryCta {
  headline: string;
  description: string | null;
  button_label: string;
  destination_url: string;
}

export interface RelatedStory {
  id: string;
  source_video_id: string | null;
  title: string;
  person_name: string | null;
  summary: string | null;
  category: string | null;
  story_format: StoryFormat;
  lead_media_url: string | null;
  thumbnail_url: string | null;
  youtube_id: string | null;
  duration_seconds: number | null;
}

export const STORY_FORMATS: Array<{ value: StoryFormat; label: string }> = [
  { value: "horizontal_video", label: "Horizontal video" },
  { value: "vertical_video", label: "Vertical video" },
  { value: "written", label: "Written story" },
  { value: "mixed", label: "Mixed media" },
];

export const CTA_SUGGESTIONS: Record<string, { headline: string; description: string; button: string }> = {
  marriage: { headline: "Your Marriage Has a Next Step Too", description: "Find people who can walk with you as your relationship grows.", button: "Find a Marriage Group" },
  community: { headline: "You Don't Have to Do Life Alone", description: "Find people who can walk through life with you.", button: "Find Your Group" },
  baptism: { headline: "Ready to Take Your Next Step?", description: "Learn what baptism means and how to take part.", button: "Get Baptized" },
  serving: { headline: "Your Gifts Can Make a Difference", description: "Find a place to serve alongside people who care.", button: "Join a Team" },
  prayer: { headline: "You Don't Have to Carry This Alone", description: "Let our prayer team stand with you in this season.", button: "Request Prayer" },
};

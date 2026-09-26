import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStoryAuthoring } from "@/hooks/useStoryAuthoring";
import { describeDestination, resolvePreset, useNextSteps } from "@/hooks/useNextSteps";
import { NextStepsManager } from "./NextStepsManager";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { CTA_SUGGESTIONS, STORY_FORMATS, type StoryBlock, type StoryBlockType, type StoryFormat, type StoryRecord } from "@/lib/storyTypes";

type VideoSource = { id: string; organization_id: string; title: string | null; channel_name: string | null; short_description: string | null; thumbnail_url: string | null; youtube_id: string; video_orientation?: string | null };
type AnalysisSource = { summary?: string | null; themes?: string[] | null; key_quotes?: Array<{ text: string }> | null } | null;

type EditableBlock = Partial<StoryBlock> & { clientId: string; block_type: StoryBlockType };
const newBlock = (block_type: StoryBlockType): EditableBlock => ({ clientId: crypto.randomUUID(), block_type, gallery_items: [] });

export function StoryAuthoringPanel({ video, analysis, isPublic }: { video: VideoSource; analysis: AnalysisSource; isPublic: boolean }) {
  const { data, isLoading, save } = useStoryAuthoring(video.id);
  const { toast } = useToast();
  const { organization } = useProfile();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState(video.title ?? "");
  const [personName, setPersonName] = useState(video.channel_name ?? "");
  const [summary, setSummary] = useState(video.short_description ?? analysis?.summary ?? "");
  const [category, setCategory] = useState(analysis?.themes?.[0] ?? "");
  // Layout follows the video itself: vertical video → vertical layout, otherwise horizontal.
  const format: StoryFormat = video.video_orientation === "vertical" ? "vertical_video" : "horizontal_video";
  const [leadMediaUrl, setLeadMediaUrl] = useState(video.thumbnail_url ?? "");
  const status: "draft" | "published" = isPublic ? "published" : "draft";
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
    setFormat(story.story_format); setLeadMediaUrl(story.lead_media_url ?? ""); setCtaMode(story.cta_mode); setCtaPresetId(story.cta_preset_id ?? null);
    setCtaHeadline(story.cta_headline ?? ""); setCtaDescription(story.cta_description ?? ""); setCtaLabel(story.cta_button_label ?? ""); setCtaUrl(story.cta_url ?? "");
    setBlocks(data.blocks.map((block) => ({ ...block, clientId: block.id })));
  }, [data]);

  const suggested = useMemo(() => {
    const haystack = `${category} ${(analysis?.themes ?? []).join(" ")}`.toLowerCase();
    const key = Object.keys(CTA_SUGGESTIONS).find((candidate) => haystack.includes(candidate));
    return key ? CTA_SUGGESTIONS[key] : CTA_SUGGESTIONS.community;
  }, [category, analysis?.themes]);

  const updateBlock = (clientId: string, patch: Partial<EditableBlock>) => setBlocks((current) => current.map((block) => block.clientId === clientId ? { ...block, ...patch } : block));
  const moveBlock = (index: number, direction: -1 | 1) => setBlocks((current) => {
    const next = [...current]; const target = index + direction;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]]; return next;
  });

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

  if (isLoading) return <Card className="flex min-h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Card>;

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
    <div className="space-y-6">
      <Card className="space-y-5 p-5 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="story-title">Story title</Label><Input id="story-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="story-person">Person or family</Label><Input id="story-person" value={personName} onChange={(event) => setPersonName(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="story-category">Category</Label><Input id="story-category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Community, baptism, serving…" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="story-summary">Opening summary</Label><Textarea id="story-summary" value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} /></div>
          <div className="space-y-2"><Label>Story format</Label><Select value={format} onValueChange={(value) => setFormat(value as StoryFormat)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STORY_FORMATS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Lead image</Label><input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadLead(file); event.target.value = ""; }} /><Button type="button" variant="outline" className="w-full" disabled={uploading} onClick={() => uploadRef.current?.click()}>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}{leadMediaUrl ? "Replace image" : "Upload image"}</Button></div>
        </div>
      </Card>

      <Card className="space-y-4 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Story sections</h3><p className="text-sm text-muted-foreground">Build a readable journey with only the sections this story needs.</p></div><Select onValueChange={(value) => setBlocks((current) => [...current, newBlock(value as StoryBlockType)])}><SelectTrigger className="w-[170px]"><Plus className="mr-2 h-4 w-4" /><SelectValue placeholder="Add section" /></SelectTrigger><SelectContent>{["heading","paragraph","quote","image","video"].map((type) => <SelectItem key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</SelectItem>)}</SelectContent></Select></div>
        {blocks.length === 0 && <div className="border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">Add a paragraph, quote, photo, or clip to begin.</div>}
        {blocks.map((block, index) => <div key={block.clientId} className="space-y-3 border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase text-muted-foreground">{block.block_type}</span><div className="flex"><Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === 0} onClick={() => moveBlock(index, -1)} aria-label="Move section up"><ArrowUp className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} aria-label="Move section down"><ArrowDown className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setBlocks((current) => current.filter((item) => item.clientId !== block.clientId))} aria-label="Remove section"><Trash2 className="h-4 w-4" /></Button></div></div>
          {block.block_type === "heading" && <Input value={block.heading ?? ""} onChange={(event) => updateBlock(block.clientId, { heading: event.target.value })} placeholder="Before, What changed, Today…" />}
          {(block.block_type === "paragraph" || block.block_type === "quote") && <Textarea rows={block.block_type === "paragraph" ? 5 : 3} value={block.body ?? ""} onChange={(event) => updateBlock(block.clientId, { body: event.target.value })} placeholder={block.block_type === "quote" ? "A defining line from the story" : "Write this part of the story"} />}
          {block.block_type === "quote" && <Input value={block.quote_attribution ?? ""} onChange={(event) => updateBlock(block.clientId, { quote_attribution: event.target.value })} placeholder="Quote attribution" />}
          {block.block_type === "image" && <><Input value={block.media_url ?? ""} onChange={(event) => updateBlock(block.clientId, { media_url: event.target.value })} placeholder="Image URL" /><Input value={block.media_alt ?? ""} onChange={(event) => updateBlock(block.clientId, { media_alt: event.target.value })} placeholder="Describe the image" /><Input value={block.caption ?? ""} onChange={(event) => updateBlock(block.clientId, { caption: event.target.value })} placeholder="Optional caption" /></>}
          {block.block_type === "video" && <div className="grid gap-3 sm:grid-cols-[1fr_180px]"><Input value={block.video_id ?? ""} onChange={(event) => updateBlock(block.clientId, { video_id: event.target.value })} placeholder="YouTube video ID" /><Select value={block.video_orientation ?? "horizontal"} onValueChange={(value) => updateBlock(block.clientId, { video_orientation: value as "horizontal" | "vertical" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="horizontal">Horizontal</SelectItem><SelectItem value="vertical">Vertical</SelectItem></SelectContent></Select></div>}
        </div>)}
      </Card>

      <Card className="space-y-5 p-5 md:p-6">
        <div><h3 className="font-semibold">Next step</h3><p className="text-sm text-muted-foreground">Give this story one natural invitation.</p></div>
        <div className="space-y-2"><Label>Invitation</Label><Select value={ctaMode === "preset" && ctaPresetId ? `preset:${ctaPresetId}` : ctaMode} onValueChange={(v) => { if (v.startsWith("preset:")) { setCtaMode("preset"); setCtaPresetId(v.slice(7)); } else { setCtaMode(v as "category_default" | "custom"); } }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="category_default">Automatic (category or church default)</SelectItem>{nextSteps.presets.map((p) => <SelectItem key={p.id} value={`preset:${p.id}`}>{p.is_global ? "Church-wide default" : p.category}</SelectItem>)}<SelectItem value="custom">Custom one-off link</SelectItem></SelectContent></Select></div>
        {ctaMode !== "custom" && (() => { const p = resolvePreset(nextSteps.presets, ctaMode, ctaPresetId, category); return p ? <div className="border border-border bg-muted/20 p-3 text-sm"><p className="font-medium">{p.headline}</p><p className="text-muted-foreground">{p.button_label} → {describeDestination(p, nextSteps.forms)}</p><p className="mt-1 text-xs text-muted-foreground">Managed centrally — updates automatically.</p></div> : <p className="text-sm text-muted-foreground">No matching next step. Add a church-wide default so every story has one.</p>; })()}
        <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => setManagerOpen(true)}>Manage church Next Steps</Button>
        <NextStepsManager orgId={video.organization_id} open={managerOpen} onOpenChange={setManagerOpen} />
        {ctaMode === "custom" && <div className="space-y-3"><div className="flex justify-end"><Button type="button" variant="outline" size="sm" onClick={() => { setCtaHeadline(suggested.headline); setCtaDescription(suggested.description); setCtaLabel(suggested.button); }}><Sparkles className="mr-2 h-4 w-4" />Use suggested wording</Button></div><Input value={ctaHeadline} onChange={(event) => setCtaHeadline(event.target.value)} placeholder="Short headline" /><Textarea rows={2} value={ctaDescription} onChange={(event) => setCtaDescription(event.target.value)} placeholder="One sentence" /><div className="grid gap-3 sm:grid-cols-2"><Input value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} placeholder="Button label" /><Input value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} placeholder="https://…" /></div></div>}
      </Card>
    </div>

    <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
      <Card className="overflow-hidden"><div className={format === "vertical_video" ? "aspect-[4/5] bg-story-media" : "aspect-video bg-story-media"}>{leadMediaUrl && <img src={leadMediaUrl} alt="" className="h-full w-full object-cover" />}</div><div className="space-y-3 p-5">{category && <p className="text-xs font-semibold uppercase text-primary">{category}</p>}<h3 className="text-2xl font-semibold leading-tight">{title || "Untitled story"}</h3>{personName && <p className="text-sm text-muted-foreground">{personName}</p>}<p className="line-clamp-4 text-sm leading-6 text-muted-foreground">{summary || "Your opening summary will appear here."}</p></div></Card>
      <Card className="space-y-3 p-5"><p className="text-xs text-muted-foreground">{isPublic ? "This story is public — saving updates the live page." : "Turn on Public at the top to show this story in the Story Library."}</p><Button className="w-full" disabled={save.isPending || !title.trim()} onClick={() => void saveStory()}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save story</Button>{organization?.slug && <Button asChild variant="outline" className="w-full"><a href={`/${organization.slug}/content/videos/${video.id}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Preview story page</a></Button>}</Card>
    </aside>
  </div>;
}

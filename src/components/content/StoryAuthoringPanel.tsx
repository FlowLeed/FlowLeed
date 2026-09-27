import { useRef, useState } from "react";
import { Eye, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import PublicContentVideoPage from "@/pages/content/PublicContentVideoPage";
import { StoryBlockCanvas, newBlock, type EditableBlock } from "./StoryBlockCanvas";
import { useStoryEditor, type StoryDraft } from "./StoryEditorContext";

type DraftBlock = { type: "heading" | "paragraph" | "quote"; text: string; attribution?: string };

export function StoryAuthoringPanel() {
  const editor = useStoryEditor();
  const { toast } = useToast();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [previewDraft, setPreviewDraft] = useState<StoryDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const { format, leadMediaUrl, uploading, uploadLead, title, setTitle, personName, setPersonName, summary, setSummary, blocks, setBlocks, organizationId, videoId } = editor;

  const draftFromTranscript = async () => {
    const hasContent = blocks.some((b) => b.block_type !== "next_step");
    if (hasContent && !window.confirm("Replace your current story sections with an AI draft? Your Next Step sections will be kept.")) return;
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke("content-story-draft", { body: { videoId } });
      if (error || data?.error) {
        let msg = data?.error as string | undefined;
        try { msg = msg ?? (await (error as any)?.context?.json())?.error; } catch { /* ignore */ }
        throw new Error(msg || "Couldn't draft the story.");
      }
      const generated: EditableBlock[] = (data.blocks as DraftBlock[]).map((b) => {
        const block = newBlock(b.type);
        if (b.type === "heading") return { ...block, heading: b.text };
        if (b.type === "quote") return { ...block, body: b.text, quote_attribution: b.attribution ?? personName ?? "" };
        return { ...block, body: b.text };
      });
      setBlocks((current) => {
        const nextSteps = current.filter((b) => b.block_type === "next_step");
        return [...generated, ...(nextSteps.length ? nextSteps : [newBlock("next_step")])];
      });
      if (data.title) setTitle(data.title);
      if (data.person_name && !personName.trim()) setPersonName(data.person_name);
      if (data.summary) setSummary(data.summary);
      toast({ title: "Story drafted", description: "Review and tweak it, then click Save story." });
    } catch (e) {
      toast({ title: "Couldn't draft story", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setDrafting(false);
    }
  };

  if (editor.isLoading) return <Card className="flex min-h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Card>;

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
    {/* Canvas */}
    <div className="space-y-4">
      <Card className="space-y-5 p-5 md:p-8">
        <div className="group relative overflow-hidden rounded-lg bg-story-media">
          <div className={format === "vertical_video" ? "aspect-[4/5]" : "aspect-video"}>
            {leadMediaUrl
              ? <img src={leadMediaUrl} alt="" className="h-full w-full object-cover" />
              : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No opening photo yet</div>}
          </div>
          <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadLead(file); event.target.value = ""; }} />
          <Button type="button" size="sm" variant="secondary" className="absolute right-3 top-3" disabled={uploading} onClick={() => uploadRef.current?.click()}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
            {leadMediaUrl ? "Replace photo" : "Add photo"}
          </Button>
        </div>
        <div className="space-y-2">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Story title" className="h-auto border-0 bg-transparent px-0 text-3xl font-semibold leading-tight shadow-none focus-visible:ring-0" />
          <Input value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Person or family" className="h-8 border-0 bg-transparent px-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0" />
          <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={2} placeholder="One or two sentences that open the story…" className="border-0 bg-transparent px-0 text-base leading-7 text-muted-foreground shadow-none focus-visible:ring-0" />
        </div>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Draft from transcript</p>
          <p className="text-xs text-muted-foreground">Let AI write chapters, story text and quotes from the video. You can tweak everything after.</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={drafting} onClick={() => void draftFromTranscript()}>
          {drafting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {drafting ? "Writing story…" : "Draft story"}
        </Button>
      </Card>

      <StoryBlockCanvas blocks={blocks} setBlocks={setBlocks} organizationId={organizationId} videoId={videoId} />

    </div>

    {/* Inspector */}
    <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
      <Card className="space-y-3 p-5">
        <p className="text-xs text-muted-foreground">{editor.isPublic ? "This story is public — saving updates the live page." : "Turn on Public at the top to show this story in the Story Library."}</p>
        <Button className="w-full" disabled={editor.savePending || !editor.hasTitle} onClick={() => void editor.saveStory()}>{editor.savePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save story</Button>
        {editor.organizationSlug && <Button variant="outline" className="w-full" onClick={() => setPreviewDraft(editor.buildDraft())}><Eye className="mr-2 h-4 w-4" />Preview story page</Button>}
      </Card>
    </aside>

    {previewDraft && editor.organizationSlug && <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <p className="text-sm font-medium">Preview — exactly what visitors will see (unsaved changes included)</p>
        <Button size="sm" variant="outline" onClick={() => setPreviewDraft(null)}><X className="mr-2 h-4 w-4" />Back to editor</Button>
      </div>
      <div className="min-h-0 flex-1">
        <PublicContentVideoPage previewSlug={editor.organizationSlug} previewVideoId={videoId} previewDraft={previewDraft} />
      </div>
    </div>}
  </div>;
}

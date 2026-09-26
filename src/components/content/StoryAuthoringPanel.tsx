import { useRef } from "react";
import { ExternalLink, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StoryBlockCanvas } from "./StoryBlockCanvas";
import { storyDraftKey, useStoryEditor } from "./StoryEditorContext";

export function StoryAuthoringPanel() {
  const editor = useStoryEditor();
  const uploadRef = useRef<HTMLInputElement>(null);
  const { format, leadMediaUrl, uploading, uploadLead, title, setTitle, personName, setPersonName, summary, setSummary, blocks, setBlocks, organizationId, videoId } = editor;

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

      <StoryBlockCanvas blocks={blocks} setBlocks={setBlocks} organizationId={organizationId} videoId={videoId} />

    </div>

    {/* Inspector */}
    <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
      <Card className="space-y-3 p-5">
        <p className="text-xs text-muted-foreground">{editor.isPublic ? "This story is public — saving updates the live page." : "Turn on Public at the top to show this story in the Story Library."}</p>
        <Button className="w-full" disabled={editor.savePending || !editor.hasTitle} onClick={() => void editor.saveStory()}>{editor.savePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save story</Button>
        {editor.organizationSlug && <Button variant="outline" className="w-full" onClick={() => {
          const previewId = crypto.randomUUID();
          const draft = JSON.stringify(editor.buildDraft());
          // Keep both a unique snapshot and a latest snapshot. The latter makes
          // preview reliable in browsers that strip or delay popup query state.
          localStorage.setItem(storyDraftKey(editor.videoId, previewId), draft);
          localStorage.setItem(storyDraftKey(editor.videoId), draft);
          window.open(`/${editor.organizationSlug}/content/videos/${editor.videoId}?preview=${encodeURIComponent(previewId)}&v=${Date.now()}`, "_blank");
        }}><ExternalLink className="mr-2 h-4 w-4" />Preview story page</Button>}
      </Card>
    </aside>
  </div>;
}

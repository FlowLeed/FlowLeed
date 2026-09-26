import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { describeDestination } from "@/hooks/useNextSteps";
import { NextStepsManager } from "./NextStepsManager";
import { useStoryEditor } from "./StoryEditorContext";

export function StoryEditorSettings() {
  const editor = useStoryEditor();

  if (editor.isLoading) return <Card className="flex items-center justify-center p-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></Card>;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Story details</h3>
          <Button size="sm" disabled={editor.savePending || !editor.hasTitle} onClick={() => void editor.saveStory()}>
            {editor.savePending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save story
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="story-category">Category</Label>
          <Input id="story-category" value={editor.category} onChange={(event) => editor.setCategory(event.target.value)} placeholder="Community, baptism, serving…" />
        </div>
        <p className="text-xs text-muted-foreground">Layout follows the video: {editor.format === "vertical_video" ? "tall video layout" : "wide video layout"}.</p>
      </Card>

      <Card className="space-y-4 p-5">
        <div><h3 className="font-semibold">Next step</h3><p className="text-sm text-muted-foreground">Give this story one natural invitation.</p></div>
        <Select value={editor.ctaMode === "preset" && editor.ctaPresetId ? `preset:${editor.ctaPresetId}` : editor.ctaMode} onValueChange={(v) => { if (v.startsWith("preset:")) { editor.setCtaMode("preset"); editor.setCtaPresetId(v.slice(7)); } else { editor.setCtaMode(v as "category_default" | "custom"); } }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="category_default">Automatic (category or church default)</SelectItem>
            {editor.nextSteps.presets.map((p) => <SelectItem key={p.id} value={`preset:${p.id}`}>{p.is_global ? "Church-wide default" : p.category}</SelectItem>)}
            <SelectItem value="custom">Custom one-off link</SelectItem>
          </SelectContent>
        </Select>
        {editor.ctaMode !== "custom" && (editor.resolvedPreset
          ? <p className="text-xs text-muted-foreground">Managed centrally — updates automatically.</p>
          : <p className="text-sm text-muted-foreground">No matching next step. Add a church-wide default so every story has one.</p>)}
        <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => editor.setManagerOpen(true)}>Manage church Next Steps</Button>
        <NextStepsManager orgId={editor.organizationId} open={editor.managerOpen} onOpenChange={editor.setManagerOpen} />
        {editor.ctaMode === "custom" && <div className="space-y-3">
          <div className="flex justify-end"><Button type="button" variant="outline" size="sm" onClick={() => { editor.setCtaHeadline(editor.suggested.headline); editor.setCtaDescription(editor.suggested.description); editor.setCtaLabel(editor.suggested.button); }}><Sparkles className="mr-2 h-4 w-4" />Suggest wording</Button></div>
          <Input value={editor.ctaHeadline} onChange={(event) => editor.setCtaHeadline(event.target.value)} placeholder="Short headline" />
          <Textarea rows={2} value={editor.ctaDescription} onChange={(event) => editor.setCtaDescription(event.target.value)} placeholder="One sentence" />
          <Input value={editor.ctaLabel} onChange={(event) => editor.setCtaLabel(event.target.value)} placeholder="Button label" />
          <Input value={editor.ctaUrl} onChange={(event) => editor.setCtaUrl(event.target.value)} placeholder="https://…" />
        </div>}
      </Card>
    </div>
  );
}

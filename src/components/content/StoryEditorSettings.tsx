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
        <p className="text-sm text-muted-foreground">Add or remove Next Step sections in the Story tab. Presets are managed for the whole church.</p>
        <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => editor.setManagerOpen(true)}>Manage church Next Steps</Button>
      </Card>
    </div>
  );
}

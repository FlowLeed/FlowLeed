import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { describeDestination, resolvePreset } from "@/hooks/useNextSteps";
import type { EditableBlock } from "./StoryBlockCanvas";
import { useStoryEditor } from "./StoryEditorContext";

/** A Next Step section. Its choice lives in block.body: "auto" | "preset:<id>" | "custom". */
export function NextStepBlockEditor({ block, update }: { block: EditableBlock; update: (patch: Partial<EditableBlock>) => void }) {
  const editor = useStoryEditor();
  const choice = block.body || "auto";
  const preset = choice === "custom" ? null : resolvePreset(editor.nextSteps.presets, choice.startsWith("preset:") ? "preset" : "category_default", choice.startsWith("preset:") ? choice.slice(7) : null, editor.category);

  return <div className="space-y-3">
    <div className="rounded-lg bg-muted/50 p-4">
      {choice === "custom"
        ? <><p className="text-lg font-semibold">{editor.ctaHeadline || "Add a headline"}</p><p className="text-sm text-muted-foreground">{editor.ctaDescription || "Add one sentence"}</p><p className="text-sm font-medium text-primary">{editor.ctaLabel || "Button label"}</p></>
        : preset
          ? <><p className="text-lg font-semibold">{preset.headline}</p>{preset.description && <p className="text-sm text-muted-foreground">{preset.description}</p>}<p className="text-sm font-medium text-primary">{preset.button_label} → {describeDestination(preset, editor.nextSteps.forms)}</p></>
          : <p className="text-sm text-muted-foreground">No matching next step yet — pick one below or add a church-wide default.</p>}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <Select value={choice} onValueChange={(value) => update({ body: value })}>
        <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Automatic (category or church default)</SelectItem>
          {editor.nextSteps.presets.map((p) => <SelectItem key={p.id} value={`preset:${p.id}`}>{p.is_global ? "Church-wide default" : p.category} — {p.headline}</SelectItem>)}
          <SelectItem value="custom">Custom one-off link</SelectItem>
        </SelectContent>
      </Select>
      <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => editor.setManagerOpen(true)}>Manage church Next Steps</Button>
    </div>
    {choice === "custom" && <div className="space-y-3">
      <div className="flex justify-end"><Button type="button" variant="outline" size="sm" onClick={() => { editor.setCtaHeadline(editor.suggested.headline); editor.setCtaDescription(editor.suggested.description); editor.setCtaLabel(editor.suggested.button); }}><Sparkles className="mr-2 h-4 w-4" />Suggest wording</Button></div>
      <Input value={editor.ctaHeadline} onChange={(e) => editor.setCtaHeadline(e.target.value)} placeholder="Short headline" />
      <Textarea rows={2} value={editor.ctaDescription} onChange={(e) => editor.setCtaDescription(e.target.value)} placeholder="One sentence" />
      <Input value={editor.ctaLabel} onChange={(e) => editor.setCtaLabel(e.target.value)} placeholder="Button label" />
      <Input value={editor.ctaUrl} onChange={(e) => editor.setCtaUrl(e.target.value)} placeholder="https://…" />
    </div>}
  </div>;
}

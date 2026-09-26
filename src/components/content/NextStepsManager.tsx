import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { describeDestination, useNextSteps, type NextStepPreset } from "@/hooks/useNextSteps";

type Draft = Partial<NextStepPreset>;

export function NextStepsManager({ orgId, open, onOpenChange }: { orgId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { presets, forms, isLoading, upsert, remove } = useNextSteps(orgId);
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const hasGlobal = presets.some((p) => p.is_global);

  const save = async () => {
    if (!draft) return;
    const d = draft;
    if (!d.headline?.trim() || !d.button_label?.trim() || (!d.is_global && !d.category?.trim())) return toast({ title: "Name, headline and button are required", variant: "destructive" });
    if (d.destination_type === "form" ? !d.form_id : !d.destination_url?.trim()) return toast({ title: "Choose where the button goes", variant: "destructive" });
    try {
      await upsert.mutateAsync({
        ...(d.id ? { id: d.id } : {}), organization_id: orgId, is_global: Boolean(d.is_global),
        category: d.is_global ? null : d.category!.trim(), headline: d.headline.trim(), description: d.description?.trim() || null,
        button_label: d.button_label.trim(), destination_type: d.destination_type ?? "url",
        destination_url: d.destination_type === "form" ? null : d.destination_url!.trim(), form_id: d.destination_type === "form" ? d.form_id! : null,
      });
      setDraft(null); toast({ title: "Next step saved — every story using it is updated" });
    } catch (e) { toast({ title: "Not saved", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
  };

  return <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setDraft(null); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Story Next Steps</DialogTitle>
        <DialogDescription>Manage invitations in one place. Change a link here and every story using it updates.</DialogDescription>
      </DialogHeader>
      {draft ? <div className="space-y-4">
        {!draft.is_global && <div className="space-y-2"><Label>Category / name</Label><Input value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Baptism, Community, Serving…" /><p className="text-xs text-muted-foreground">Stories with this category use it automatically.</p></div>}
        <div className="space-y-2"><Label>Headline</Label><Input value={draft.headline ?? ""} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} placeholder="You Don't Have to Do Life Alone" /></div>
        <div className="space-y-2"><Label>One sentence</Label><Textarea rows={2} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2"><Label>Button label</Label><Input value={draft.button_label ?? ""} onChange={(e) => setDraft({ ...draft, button_label: e.target.value })} placeholder="Find Your Group" /></div>
          <div className="space-y-2"><Label>Button goes to</Label><Select value={draft.destination_type ?? "url"} onValueChange={(v) => setDraft({ ...draft, destination_type: v as "url" | "form" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="url">Website link</SelectItem><SelectItem value="form">FlowLeed form</SelectItem></SelectContent></Select></div>
        </div>
        {draft.destination_type === "form"
          ? <div className="space-y-2"><Label>Form</Label><Select value={draft.form_id ?? ""} onValueChange={(v) => setDraft({ ...draft, form_id: v })}><SelectTrigger><SelectValue placeholder={forms.length ? "Choose a form" : "No forms yet"} /></SelectTrigger><SelectContent>{forms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}{!f.is_published && " (not published)"}</SelectItem>)}</SelectContent></Select>{forms.find((f) => f.id === draft.form_id && !f.is_published) && <p className="text-xs text-destructive">This form isn't published yet — visitors won't see the button until you publish it.</p>}</div>
          : <div className="space-y-2"><Label>Link</Label><Input value={draft.destination_url ?? ""} onChange={(e) => setDraft({ ...draft, destination_url: e.target.value })} placeholder="https://…" /></div>}
        <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={() => void save()} disabled={upsert.isPending}>{upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button></DialogFooter>
      </div> : <div className="space-y-3">
        {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /> : <>
          {!hasGlobal && <div className="border border-dashed border-border p-4 text-sm text-muted-foreground">No church-wide default yet. Stories without a matching category will show no next step. <Button variant="link" className="h-auto p-0" onClick={() => setDraft({ is_global: true, destination_type: "url" })}>Add default</Button></div>}
          {presets.map((p) => <div key={p.id} className="flex items-start gap-3 border border-border p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{p.is_global ? "Church-wide default" : p.category}</span>{p.is_global && <Badge variant="secondary">Fallback</Badge>}</div>
              <p className="truncate text-sm">{p.headline} · <span className="text-muted-foreground">{p.button_label}</span></p>
              <p className="truncate text-xs text-muted-foreground">{describeDestination(p, forms)}</p>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDraft(p)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete this next step? Stories using it will fall back to their category or the church-wide default.")) remove.mutate(p.id); }} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
          </div>)}
          <Button variant="outline" className="w-full" onClick={() => setDraft({ is_global: false, destination_type: "url" })}><Plus className="mr-2 h-4 w-4" />Add category next step</Button>
        </>}
      </div>}
    </DialogContent>
  </Dialog>;
}

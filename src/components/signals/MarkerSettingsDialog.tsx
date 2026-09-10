import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RotateCcw } from "lucide-react";
import type { MarkerCatalogEntry } from "@/hooks/useMarkerCatalog";
import { markerParamSpecs, paramValue } from "@/lib/markerParams";
import { useSaveMarkerSettings, useResetMarkerSettings } from "@/hooks/useMarkerSettings";

interface Props {
  marker: MarkerCatalogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkerSettingsDialog({ marker, open, onOpenChange }: Props) {
  const save = useSaveMarkerSettings();
  const reset = useResetMarkerSettings();
  const specs = marker ? markerParamSpecs[marker.key] || [] : [];

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [params, setParams] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!marker) return;
    setLabel(marker.label || "");
    setDescription(marker.description || "");
    setEnabled(marker.enabled !== false);
    const next: Record<string, number> = {};
    for (const s of markerParamSpecs[marker.key] || []) {
      next[s.key] = paramValue(marker.params as any, s);
    }
    setParams(next);
  }, [marker]);

  if (!marker) return null;

  const handleSave = async () => {
    const cleaned: Record<string, number> = {};
    for (const s of specs) {
      const v = params[s.key];
      if (Number.isFinite(v) && v !== s.default) cleaned[s.key] = v;
      else if (Number.isFinite(v)) cleaned[s.key] = v;
    }
    await save.mutateAsync({
      markerKey: marker.key,
      enabled,
      customLabel: label.trim() === (marker.default_label || "").trim() ? null : label.trim(),
      customDescription:
        description.trim() === (marker.default_description || "").trim() ? null : description.trim(),
      params: cleaned,
    });
    onOpenChange(false);
  };

  const handleReset = async () => {
    await reset.mutateAsync(marker.key);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit signal</DialogTitle>
          <DialogDescription>
            Change how this signal appears and when it fires. This only affects your church.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Track this signal</p>
              <p className="text-xs text-muted-foreground">
                Turn off to hide it from people, filters and the AI agent.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="marker-label">Name</Label>
            <Input id="marker-label" value={label} onChange={(e) => setLabel(e.target.value)} />
            <p className="text-xs text-muted-foreground">Default: {marker.default_label}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="marker-description">Explanation</Label>
            <Textarea
              id="marker-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {specs.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">When it fires</p>
              {specs.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`p-${s.key}`} className="text-xs font-normal text-muted-foreground flex-1">
                    {s.label}
                  </Label>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Input
                      id={`p-${s.key}`}
                      type="number"
                      min={s.min}
                      max={s.max}
                      className="w-20 h-8"
                      value={params[s.key] ?? s.default}
                      onChange={(e) =>
                        setParams((prev) => ({ ...prev, [s.key]: Number(e.target.value) }))
                      }
                    />
                    {s.suffix && (
                      <span className="text-xs text-muted-foreground w-20">{s.suffix}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              This signal's timing can't be adjusted. For something more specific, create a Custom
              Signal instead.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="gap-2"
            onClick={handleReset}
            disabled={reset.isPending || !marker.is_customized}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to default
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

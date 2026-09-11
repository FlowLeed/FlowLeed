import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { MarkerCatalogEntry } from "@/hooks/useMarkerCatalog";

import { markerLogicSeed, severityForPolarity } from "@/lib/markerLogicSeeds";
import {
  useSaveMarkerSettings,
  useResetMarkerSettings,
  usePromoteMarkerToCustom,
} from "@/hooks/useMarkerSettings";
import { ConditionBuilder } from "@/components/signals/ConditionBuilder";
import type {
  CustomSignalCondition,
  RuleCombinator,
  SignalPolarity,
  SignalSeverity,
} from "@/hooks/useCustomSignals";

interface Props {
  marker: MarkerCatalogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkerSettingsDialog({ marker, open, onOpenChange }: Props) {
  const save = useSaveMarkerSettings();
  const reset = useResetMarkerSettings();
  const promote = usePromoteMarkerToCustom();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);

  const [polarity, setPolarity] = useState<SignalPolarity>("neutral");
  const [severity, setSeverity] = useState<SignalSeverity>("info");
  const [combinator, setCombinator] = useState<RuleCombinator>("AND");
  const [conditions, setConditions] = useState<CustomSignalCondition[]>([]);

  const promotedId = marker?.promoted_signal_id || null;

  // Existing church-owned rule, when this built-in has already been rewritten.
  const { data: promotedRule } = useQuery({
    queryKey: ["promoted-signal-rule", promotedId],
    enabled: !!promotedId && open,
    queryFn: async () => {
      const [ruleResult, signalResult] = await Promise.all([
        supabase
          .from("custom_signal_rules" as any)
          .select("rule_combinator, conditions")
          .eq("signal_id", promotedId)
          .maybeSingle(),
        supabase
          .from("custom_signals" as any)
          .select("polarity, severity, enabled")
          .eq("id", promotedId)
          .maybeSingle(),
      ]);
      if (ruleResult.error) throw ruleResult.error;
      if (signalResult.error) throw signalResult.error;
      return {
        ...(ruleResult.data as any),
        signal: signalResult.data as any,
      };
    },
  });

  const seed = marker ? markerLogicSeed(marker.key, marker.params as any) : null;

  useEffect(() => {
    if (!marker || !open) return;
    
    setLabel(marker.label || "");
    setDescription(marker.description || "");
    setEnabled(marker.enabled !== false || !!marker.promoted_signal_id);
    setPolarity((marker.polarity as SignalPolarity) || "neutral");
    setSeverity(severityForPolarity(marker.polarity));
  }, [marker, open]);

  useEffect(() => {
    if (!marker || !open) return;
    if (promotedRule) {
      setCombinator((promotedRule.rule_combinator as RuleCombinator) || "AND");
      setConditions((promotedRule.conditions as CustomSignalCondition[]) || []);
      setPolarity((promotedRule.signal?.polarity as SignalPolarity) || "neutral");
      setSeverity((promotedRule.signal?.severity as SignalSeverity) || "info");
      setEnabled(promotedRule.signal?.enabled !== false);
    } else {
      const s = markerLogicSeed(marker.key, marker.params as any);
      setCombinator(s.combinator);
      setConditions(s.conditions);
    }
  }, [marker, open, promotedRule]);

  if (!marker) return null;

  const seedKey = JSON.stringify({
    c: seed?.combinator ?? "AND",
    x: seed?.conditions ?? [],
  });
  const currentKey = JSON.stringify({ c: combinator, x: conditions });
  const logicChanged = currentKey !== seedKey;
  const logicValid = conditions.length > 0 && conditions.every((c) => {
    if (!c.source || !c.operator) return false;
    if (c.operator === "unassigned" || c.operator === "true" || c.operator === "false") return true;
    if (c.source === "moment.days_since_type") {
      return !!c.value?.moment_type_id && c.value?.days !== "" && c.value?.days !== undefined;
    }
    return c.value !== "" && c.value !== null && c.value !== undefined;
  });
  const needsPromote = !!promotedId || logicChanged;

  const handleSave = async () => {
    await save.mutateAsync({
      markerKey: marker.key,
      enabled,
      customLabel: label.trim() === (marker.default_label || "").trim() ? null : label.trim(),
      customDescription:
        description.trim() === (marker.default_description || "").trim() ? null : description.trim(),
      params: (marker.params as Record<string, number>) || {},
    });
    if (needsPromote && logicValid) {
      await promote.mutateAsync({
        markerKey: marker.key,
        label: label.trim() || marker.default_label,
        description: description.trim() || null,
        polarity,
        severity,
        enabled,
        combinator,
        conditions,
        existingSignalId: promotedId,
      });
    }
    onOpenChange(false);
  };

  const handleReset = async () => {
    await reset.mutateAsync(marker.key);
    onOpenChange(false);
  };

  const saving = save.isPending || promote.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Edit signal</DialogTitle>
          <DialogDescription>
            Change how this signal appears and when it fires. This only affects your church.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4 px-6 overflow-y-auto flex-1 min-h-0">
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

          

          <div className="space-y-4 border-t pt-5">
            <div>
              <p className="text-sm font-medium">When it fires</p>
              <p className="text-xs text-muted-foreground">
                {promotedId
                  ? "This signal uses your own rule. Change the conditions below."
                  : "Change these conditions to replace the built-in rule with your church's own version."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Polarity</Label>
                <Select value={polarity} onValueChange={(v) => setPolarity(v as SignalPolarity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="negative">Negative (risk)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as SignalSeverity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="watch">Watch</SelectItem>
                    <SelectItem value="risk">Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ConditionBuilder
              combinator={combinator}
              onCombinatorChange={setCombinator}
              conditions={conditions}
              onConditionsChange={setConditions}
            />

            {!promotedId && seed?.note && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{seed.note}</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between px-6 py-4 border-t bg-background shrink-0">
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
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || (needsPromote && !logicValid)}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


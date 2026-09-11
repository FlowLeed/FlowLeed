import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConditionBuilder } from "@/components/signals/ConditionBuilder";
import {
  useCustomSignals,
  type CustomSignal,
  type CustomSignalCondition,
  type RuleCombinator,
  type SignalPolarity,
  type SignalSeverity,
} from "@/hooks/useCustomSignals";

interface Props {
  signal: CustomSignal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomSignalEditorDialog({ signal, open, onOpenChange }: Props) {
  const { create, update } = useCustomSignals();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [polarity, setPolarity] = useState<SignalPolarity>("neutral");
  const [severity, setSeverity] = useState<SignalSeverity>("info");
  const [combinator, setCombinator] = useState<RuleCombinator>("AND");
  const [conditions, setConditions] = useState<CustomSignalCondition[]>([]);

  useEffect(() => {
    if (!open) return;
    setLabel(signal?.label ?? "");
    setDescription(signal?.description ?? "");
    setPolarity(signal?.polarity ?? "neutral");
    setSeverity(signal?.severity ?? "info");
    setCombinator(signal?.rule?.combinator ?? "AND");
    setConditions(signal?.rule?.conditions ?? []);
  }, [signal, open]);

  const canSave =
    label.trim().length > 0 &&
    conditions.length > 0 &&
    conditions.every((c) => c.source && c.operator);

  const handleSave = async () => {
    if (!canSave) return;
    if (signal) {
      await update.mutateAsync({
        id: signal.id,
        label,
        description,
        polarity,
        severity,
        combinator,
        conditions,
      });
    } else {
      await create.mutateAsync({
        label,
        description,
        polarity,
        severity,
        combinator,
        conditions,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{signal ? "Edit signal" : "New custom signal"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Missed 3 Sundays in a row" />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description shown on contact profiles"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Polarity</Label>
              <Select value={polarity} onValueChange={(v) => setPolarity(v as SignalPolarity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="watch">Watch</SelectItem>
                  <SelectItem value="risk">Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-2 border-t">
            <ConditionBuilder
              combinator={combinator}
              onCombinatorChange={setCombinator}
              conditions={conditions}
              onConditionsChange={setConditions}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || create.isPending || update.isPending}>
            {signal ? "Save changes" : "Create signal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

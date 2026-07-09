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
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import {
  useCustomSignals,
  type CustomSignal,
  type CustomSignalCondition,
  type RuleCombinator,
  type SignalPolarity,
  type SignalSeverity,
} from "@/hooks/useCustomSignals";
import { cn } from "@/lib/utils";

// Available condition sources — shared with the future edge-function evaluator.
const CONDITION_SOURCES: Array<{
  value: string;
  label: string;
  category: string;
  operators: Array<{ value: string; label: string; input?: "number" | "days" | "text" | "none" }>;
}> = [
  {
    value: "attendance.last_service_days_ago",
    label: "Days since last service",
    category: "Attendance",
    operators: [
      { value: "lte", label: "is at most", input: "days" },
      { value: "gte", label: "is at least", input: "days" },
    ],
  },
  {
    value: "attendance.services_last_n_weeks",
    label: "Services attended (last 12w)",
    category: "Attendance",
    operators: [
      { value: "gte", label: "is at least", input: "number" },
      { value: "lte", label: "is at most", input: "number" },
    ],
  },
  {
    value: "attendance.is_first_time_guest",
    label: "First-time guest (last 30d)",
    category: "Attendance",
    operators: [{ value: "true", label: "is true", input: "none" }],
  },
  {
    value: "group.is_in_group",
    label: "Is in a group",
    category: "Groups",
    operators: [
      { value: "true", label: "yes", input: "none" },
      { value: "false", label: "no", input: "none" },
    ],
  },
  {
    value: "group.attendance_rate",
    label: "Group attendance rate",
    category: "Groups",
    operators: [
      { value: "gte", label: "is at least (%)", input: "number" },
      { value: "lte", label: "is at most (%)", input: "number" },
    ],
  },
  {
    value: "serve.days_since_last",
    label: "Days since last serve",
    category: "Serving",
    operators: [
      { value: "lte", label: "is at most", input: "days" },
      { value: "gte", label: "is at least", input: "days" },
    ],
  },
  {
    value: "flow.in_any_flow",
    label: "Is in any active flow",
    category: "Flows",
    operators: [
      { value: "true", label: "yes", input: "none" },
      { value: "false", label: "no", input: "none" },
    ],
  },
  {
    value: "flow.days_in_stage",
    label: "Days in current stage",
    category: "Flows",
    operators: [
      { value: "gte", label: "is at least", input: "days" },
      { value: "lte", label: "is at most", input: "days" },
    ],
  },
  {
    value: "tag.has",
    label: "Has tag",
    category: "Tags",
    operators: [{ value: "eq", label: "equals", input: "text" }],
  },
  {
    value: "tag.not_has",
    label: "Does not have tag",
    category: "Tags",
    operators: [{ value: "eq", label: "equals", input: "text" }],
  },
];

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

  const addCondition = () => {
    setConditions((c) => [
      ...c,
      { source: CONDITION_SOURCES[0].value, operator: CONDITION_SOURCES[0].operators[0].value, value: "", condition_group: 0 },
    ]);
  };

  const updateCond = (i: number, patch: Partial<CustomSignalCondition>) => {
    setConditions((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const removeCond = (i: number) => setConditions((prev) => prev.filter((_, idx) => idx !== i));

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

          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Trigger when</span>
                <Select value={combinator} onValueChange={(v) => setCombinator(v as RuleCombinator)}>
                  <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">ALL (AND)</SelectItem>
                    <SelectItem value="OR">ANY (OR)</SelectItem>
                  </SelectContent>
                </Select>
                <span>match</span>
              </div>
              <Button size="sm" variant="outline" onClick={addCondition} className="gap-1">
                <Plus className="h-3 w-3" /> Add condition
              </Button>
            </div>

            {conditions.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Add at least one condition.</p>
            )}

            <div className="space-y-2">
              {conditions.map((c, i) => {
                const src = CONDITION_SOURCES.find((s) => s.value === c.source) || CONDITION_SOURCES[0];
                const op = src.operators.find((o) => o.value === c.operator) || src.operators[0];
                return (
                  <div key={i} className={cn("flex items-center gap-2 p-2 rounded-lg border bg-muted/30")}>
                    <Badge variant="outline" className="text-[10px]">{src.category}</Badge>
                    <Select
                      value={c.source}
                      onValueChange={(v) => {
                        const nextSrc = CONDITION_SOURCES.find((s) => s.value === v)!;
                        updateCond(i, { source: v, operator: nextSrc.operators[0].value, value: "" });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs w-[220px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITION_SOURCES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={c.operator} onValueChange={(v) => updateCond(i, { operator: v })}>
                      <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {src.operators.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {op.input && op.input !== "none" && (
                      <Input
                        className="h-8 text-xs w-24"
                        type={op.input === "text" ? "text" : "number"}
                        value={c.value ?? ""}
                        onChange={(e) => updateCond(i, { value: e.target.value })}
                        placeholder={op.input === "days" ? "days" : op.input === "number" ? "#" : "value"}
                      />
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 ml-auto" onClick={() => removeCond(i)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
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

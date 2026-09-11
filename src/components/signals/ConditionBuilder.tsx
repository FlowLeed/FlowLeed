import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { CONDITION_SOURCES, findSource } from "@/lib/signalConditions";
import type { CustomSignalCondition, RuleCombinator } from "@/hooks/useCustomSignals";

interface Props {
  combinator: RuleCombinator;
  onCombinatorChange: (c: RuleCombinator) => void;
  conditions: CustomSignalCondition[];
  onConditionsChange: (c: CustomSignalCondition[]) => void;
}

export function ConditionBuilder({
  combinator,
  onCombinatorChange,
  conditions,
  onConditionsChange,
}: Props) {
  const addCondition = () =>
    onConditionsChange([
      ...conditions,
      {
        source: CONDITION_SOURCES[0].value,
        operator: CONDITION_SOURCES[0].operators[0].value,
        value: "",
        condition_group: 0,
      },
    ]);

  const updateCond = (i: number, patch: Partial<CustomSignalCondition>) =>
    onConditionsChange(conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const removeCond = (i: number) =>
    onConditionsChange(conditions.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Trigger when</span>
          <Select value={combinator} onValueChange={(v) => onCombinatorChange(v as RuleCombinator)}>
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">ALL (AND)</SelectItem>
              <SelectItem value="OR">ANY (OR)</SelectItem>
            </SelectContent>
          </Select>
          <span>match</span>
        </div>
        <Button size="sm" variant="outline" onClick={addCondition} className="gap-1" type="button">
          <Plus className="h-3 w-3" /> Add condition
        </Button>
      </div>

      {conditions.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Add at least one condition.</p>
      )}

      <div className="space-y-2">
        {conditions.map((c, i) => {
          const src = findSource(c.source);
          const op = src.operators.find((o) => o.value === c.operator) || src.operators[0];
          return (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 flex-wrap">
              <Badge variant="outline" className="text-[10px]">
                {src.category}
              </Badge>
              <Select
                value={c.source}
                onValueChange={(v) => {
                  const nextSrc = findSource(v);
                  updateCond(i, { source: v, operator: nextSrc.operators[0].value, value: "" });
                }}
              >
                <SelectTrigger className="h-8 text-xs w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={c.operator} onValueChange={(v) => updateCond(i, { operator: v })}>
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {src.operators.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
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
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 ml-auto"
                onClick={() => removeCond(i)}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

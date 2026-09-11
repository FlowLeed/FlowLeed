import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical, Plus, X } from "lucide-react";
import { CONDITION_SOURCES, findSource } from "@/lib/signalConditions";
import type { CustomSignalCondition, RuleCombinator } from "@/hooks/useCustomSignals";
import { useSignalConditionOptions } from "@/hooks/useSignalConditionOptions";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER = [
  "Attendance",
  "Campus",
  "Flows",
  "Flow Moments",
  "Groups",
  "Serving",
  "Church Online",
  "Tags",
];

interface Props {
  combinator: RuleCombinator;
  onCombinatorChange: (c: RuleCombinator) => void;
  conditions: CustomSignalCondition[];
  onConditionsChange: (c: CustomSignalCondition[]) => void;
}

function emptyValueForInput(input?: string): any {
  if (input === "window_count") return { days: "", count: "" };
  if (input === "moment_days") return { moment_type_id: "", days: "" };
  return "";
}

export function ConditionBuilder({
  combinator,
  onCombinatorChange,
  conditions,
  onConditionsChange,
}: Props) {
  const { data: optionData } = useSignalConditionOptions();
  const dynamicOptions = {
    campus: optionData?.campuses || [],
    flow: optionData?.flows || [],
    stage: optionData?.stages || [],
    moment: optionData?.moments || [],
  };
  const addCondition = () =>
    onConditionsChange([
      ...conditions,
      {
        source: CONDITION_SOURCES[0].value,
        operator: CONDITION_SOURCES[0].operators[0].value,
        value: emptyValueForInput(CONDITION_SOURCES[0].operators[0].input),
        condition_group: 0,
      },
    ]);

  const updateCond = (i: number, patch: Partial<CustomSignalCondition>) =>
    onConditionsChange(conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const removeCond = (i: number) =>
    onConditionsChange(conditions.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Trigger when</span>
          <Select value={combinator} onValueChange={(v) => onCombinatorChange(v as RuleCombinator)}>
            <SelectTrigger className="h-9 w-28 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">ALL (AND)</SelectItem>
              <SelectItem value="OR">ANY (OR)</SelectItem>
            </SelectContent>
          </Select>
          <span>of the following match</span>
      </div>

      {conditions.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Add at least one condition.</p>
      )}

      <div className="flex items-stretch gap-3">
        <div className="flex items-center shrink-0">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide shadow-sm border",
              combinator === "AND"
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
            )}
          >
            {combinator}
          </span>
        </div>
        <div className="relative flex-1 pl-5 min-w-0">
          <div
            className={cn(
              "absolute left-0 top-1 bottom-1 w-3 border-l-2 border-t-2 border-b-2 rounded-l-md pointer-events-none",
              combinator === "AND" ? "border-primary/40" : "border-amber-400/60"
            )}
          />
          <div className="space-y-2 py-1">
            {conditions.map((c, i) => {
              const src = findSource(c.source);
              const op = src.operators.find((o) => o.value === c.operator) || src.operators[0];
              return (
                <div key={i} className="group relative flex w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-full border bg-background py-1.5 pl-2 pr-11 shadow-sm transition-colors hover:border-primary/40">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              <Select
                value={src.category}
                onValueChange={(category) => {
                  const nextSrc = CONDITION_SOURCES.find((source) => source.category === category);
                  if (nextSrc) {
                    updateCond(i, {
                      source: nextSrc.value,
                      operator: nextSrc.operators[0].value,
                      value: emptyValueForInput(nextSrc.operators[0].input),
                    });
                  }
                }}
              >
                <SelectTrigger className="h-8 min-w-0 basis-[100px] shrink text-xs border-0 shadow-none bg-transparent px-1 hover:bg-muted/50">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={c.source}
                onValueChange={(v) => {
                  const nextSrc = findSource(v);
                  updateCond(i, {
                    source: v,
                    operator: nextSrc.operators[0].value,
                    value: emptyValueForInput(nextSrc.operators[0].input),
                  });
                }}
              >
                <SelectTrigger className="h-8 min-w-0 flex-[1.4] text-xs border-0 shadow-none bg-transparent px-1 hover:bg-muted/50">
                  <SelectValue placeholder="Trigger" />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_SOURCES.filter((source) => source.category === src.category).map((source) => (
                    <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={c.operator} onValueChange={(v) => updateCond(i, { operator: v })}>
                <SelectTrigger className="h-8 min-w-0 flex-1 text-xs border-0 shadow-none bg-transparent px-1 hover:bg-muted/50 font-medium">
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
              {op.input && ["campus", "flow", "stage", "moment"].includes(op.input) && (
                <Select value={String(c.value || "")} onValueChange={(value) => updateCond(i, { value })}>
                  <SelectTrigger className="h-8 min-w-0 flex-1 text-xs border-0 shadow-none bg-transparent px-1 hover:bg-muted/50">
                    <SelectValue placeholder={`Choose ${op.input}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {dynamicOptions[op.input as keyof typeof dynamicOptions].map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {op.input === "moment_days" && (
                <>
                  <Select
                    value={typeof c.value === "object" ? String(c.value?.moment_type_id || "") : ""}
                    onValueChange={(momentTypeId) => updateCond(i, {
                      value: { moment_type_id: momentTypeId, days: typeof c.value === "object" ? c.value?.days || "" : "" },
                    })}
                  >
                    <SelectTrigger className="h-8 min-w-0 flex-1 text-xs border-0 shadow-none bg-transparent px-1 hover:bg-muted/50">
                      <SelectValue placeholder="Choose Flow Moment" />
                    </SelectTrigger>
                    <SelectContent>
                      {dynamicOptions.moment.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8 w-20 shrink-0 text-xs border-0 shadow-none bg-transparent focus-visible:ring-1"
                    type="number"
                    min={0}
                    value={typeof c.value === "object" ? c.value?.days ?? "" : ""}
                    onChange={(e) => updateCond(i, {
                      value: { moment_type_id: typeof c.value === "object" ? c.value?.moment_type_id || "" : "", days: e.target.value },
                    })}
                    placeholder="days"
                  />
                </>
              )}
              {op.input === "window_count" && (
                <>
                  <Input
                    className="h-8 w-16 shrink-0 text-xs border-0 shadow-none bg-transparent focus-visible:ring-1"
                    type="number"
                    min={0}
                    value={typeof c.value === "object" ? c.value?.days ?? "" : ""}
                    onChange={(e) => updateCond(i, {
                      value: {
                        days: e.target.value,
                        count: typeof c.value === "object" ? c.value?.count ?? "" : "",
                      },
                    })}
                    placeholder="days"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">days</span>
                  <Input
                    className="h-8 w-14 shrink-0 text-xs border-0 shadow-none bg-transparent focus-visible:ring-1"
                    type="number"
                    min={0}
                    value={typeof c.value === "object" ? c.value?.count ?? "" : ""}
                    onChange={(e) => updateCond(i, {
                      value: {
                        days: typeof c.value === "object" ? c.value?.days ?? "" : "",
                        count: e.target.value,
                      },
                    })}
                    placeholder="#"
                  />
                </>
              )}
              {op.input && ["number", "days", "text"].includes(op.input) && (
                <Input
                  className="h-8 w-16 shrink-0 text-xs border-0 shadow-none bg-transparent focus-visible:ring-1"
                  type={op.input === "text" ? "text" : "number"}
                  min={op.input === "text" ? undefined : 0}
                  value={c.value ?? ""}
                  onChange={(e) => updateCond(i, { value: e.target.value })}
                  placeholder={op.input === "days" ? "days" : op.input === "number" ? "#" : "value"}
                />
              )}
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100"
                aria-label="Remove condition"
                onClick={() => removeCond(i)}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
                </div>
              );
            })}
            <Button size="sm" variant="outline" onClick={addCondition} className="h-8 gap-1" type="button">
              <Plus className="h-3.5 w-3.5" /> Add condition
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

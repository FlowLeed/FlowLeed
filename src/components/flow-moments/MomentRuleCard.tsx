import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Calendar as CalendarIcon,
  Loader2,
} from "lucide-react";
import type { FlowMomentType } from "@/hooks/useFlowMomentTypes";
import type { PcoTab, PcoField } from "@/hooks/usePcoCustomFields";
import { usePcoMomentMappings, type MomentRule, type RuleCondition } from "@/hooks/usePcoMomentMappings";
import { iconMap } from "@/lib/flowIcons";
import {
  getCombinedOptionsForField,
  needsAdditionalInput,
  encodeTriggerCondition,
  decodeTriggerCondition,
  getTriggerLabel,
} from "@/lib/pcoFieldOperators";
import { cn } from "@/lib/utils";

interface DraftCondition {
  fieldId: string;
  fieldLabel: string;
  tabName?: string;
  dataType: string;
  options: string[];
  selectedTrigger: string;
  additionalValue: string;
  condition_group: number;
}

interface MomentRuleCardProps {
  momentType: FlowMomentType;
  existingRule?: MomentRule;
  tabs: PcoTab[];
  integrationId: string;
  organizationId: string;
  startInEdit?: boolean;
  onCancelNew?: () => void;
}

const findFieldMeta = (tabs: PcoTab[], fieldId: string): { field: PcoField; tabName: string } | null => {
  for (const tab of tabs) {
    const f = tab.fields.find((x) => x.id === fieldId);
    if (f) return { field: f, tabName: tab.tabName };
  }
  return null;
};

const conditionsFromRule = (
  rule: MomentRule | undefined,
  tabs: PcoTab[]
): DraftCondition[] => {
  if (!rule) return [];
  return rule.conditions.map((c) => {
    const meta = findFieldMeta(tabs, c.fieldId);
    const dataType = meta?.field.dataType ?? "text";
    const options = meta?.field.options ?? [];
    const decoded = decodeTriggerCondition(c.operator, c.value, { dataType, options });
    return {
      fieldId: c.fieldId,
      fieldLabel: c.fieldLabel || meta?.field.name || "Unknown field",
      tabName: c.tabName ?? meta?.tabName,
      dataType,
      options,
      selectedTrigger: decoded.selectedValue,
      additionalValue: decoded.additionalValue ?? "",
      condition_group: c.condition_group,
    };
  });
};

export function MomentRuleCard({
  momentType,
  existingRule,
  tabs,
  integrationId,
  organizationId,
  startInEdit = false,
  onCancelNew,
}: MomentRuleCardProps) {
  const { saveRule, deleteRule } = usePcoMomentMappings(integrationId);
  const [isEditing, setIsEditing] = useState(startInEdit);
  const [combinator, setCombinator] = useState<'AND' | 'OR'>(existingRule?.combinator ?? 'AND');
  const [conditions, setConditions] = useState<DraftCondition[]>(
    () => conditionsFromRule(existingRule, tabs)
  );

  const groups = useMemo(() => {
    const map = new Map<number, DraftCondition[]>();
    for (const c of conditions) {
      const arr = map.get(c.condition_group) ?? [];
      arr.push(c);
      map.set(c.condition_group, arr);
    }
    return map;
  }, [conditions]);

  const nextGroupId = () => {
    const used = new Set(conditions.map((c) => c.condition_group));
    let n = 1;
    while (used.has(n)) n++;
    return n;
  };

  const addCondition = (group: number) => {
    setConditions((prev) => [
      ...prev,
      {
        fieldId: "",
        fieldLabel: "",
        tabName: undefined,
        dataType: "text",
        options: [],
        selectedTrigger: "",
        additionalValue: "",
        condition_group: group,
      },
    ]);
  };

  const removeCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, patch: Partial<DraftCondition>) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const handleFieldChange = (index: number, fieldId: string) => {
    const meta = findFieldMeta(tabs, fieldId);
    if (!meta) return;
    updateCondition(index, {
      fieldId,
      fieldLabel: meta.field.name,
      tabName: meta.tabName,
      dataType: meta.field.dataType,
      options: meta.field.options ?? [],
      selectedTrigger: "",
      additionalValue: "",
    });
  };

  const canSave = conditions.length > 0 && conditions.every((c) => c.fieldId && c.selectedTrigger);

  const handleSave = async () => {
    const built: RuleCondition[] = conditions.map((c) => {
      const enc = encodeTriggerCondition(c.selectedTrigger, c.additionalValue || null);
      return {
        fieldId: c.fieldId,
        fieldLabel: c.fieldLabel,
        tabName: c.tabName,
        operator: enc.operator,
        value: enc.value,
        condition_group: c.condition_group,
      };
    });
    await saveRule.mutateAsync({
      organizationId,
      rule: { momentTypeId: momentType.id, combinator, conditions: built },
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deleteRule.mutateAsync(momentType.id);
  };

  const handleCancel = () => {
    if (existingRule) {
      setCombinator(existingRule.combinator);
      setConditions(conditionsFromRule(existingRule, tabs));
      setIsEditing(false);
    } else {
      onCancelNew?.();
    }
  };

  const Icon = momentType.icon ? iconMap[momentType.icon] : null;
  const innerCombinator: 'AND' | 'OR' = combinator === 'AND' ? 'OR' : 'AND';

  const topLevel = groups.get(0) ?? [];
  const subGroupIds = Array.from(groups.keys()).filter((g) => g !== 0).sort((a, b) => a - b);

  const renderConditionRow = (c: DraftCondition, index: number) => {
    const triggerOptions = getCombinedOptionsForField({ dataType: c.dataType, options: c.options });
    const showExtra = needsAdditionalInput(c.selectedTrigger, c.dataType);

    return (
      <div key={index} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <Select value={c.fieldId} onValueChange={(v) => handleFieldChange(index, v)}>
          <SelectTrigger className="h-9 text-xs sm:flex-1 min-w-0">
            <SelectValue placeholder="Select field..." />
          </SelectTrigger>
          <SelectContent className="max-h-[320px]">
            {tabs.map((tab) => (
              <SelectGroup key={tab.tabName}>
                <SelectLabel>{tab.tabName}</SelectLabel>
                {tab.fields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={c.selectedTrigger}
          onValueChange={(v) => updateCondition(index, { selectedTrigger: v, additionalValue: "" })}
          disabled={!c.fieldId}
        >
          <SelectTrigger className="h-9 text-xs sm:w-56">
            <SelectValue placeholder="Trigger..." />
          </SelectTrigger>
          <SelectContent className="max-h-[280px]">
            {triggerOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showExtra && (
          c.dataType === 'date' ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 text-xs justify-start text-left font-normal sm:w-44",
                    !c.additionalValue && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {c.additionalValue ? format(new Date(c.additionalValue), 'PP') : 'Pick date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={c.additionalValue ? new Date(c.additionalValue) : undefined}
                  onSelect={(d) => updateCondition(index, { additionalValue: d ? format(d, 'yyyy-MM-dd') : "" })}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          ) : (
            <Input
              value={c.additionalValue}
              onChange={(e) => updateCondition(index, { additionalValue: e.target.value })}
              placeholder="Value"
              className="h-9 text-xs sm:w-44"
              type={c.dataType === 'number' ? 'number' : 'text'}
            />
          )
        )}

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => removeCondition(index)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  const summaryLine = (c: RuleCondition) => {
    const meta = findFieldMeta(tabs, c.fieldId);
    const dataType = meta?.field.dataType ?? "text";
    const options = meta?.field.options ?? [];
    const decoded = decodeTriggerCondition(c.operator, c.value, { dataType, options });
    return `${c.fieldLabel || meta?.field.name || 'Unknown'} — ${getTriggerLabel(decoded.selectedValue, decoded.additionalValue)}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="h-5 w-5 shrink-0" style={{ color: momentType.color || undefined }} />}
          <div className="min-w-0">
            <div className="font-semibold truncate">{momentType.name}</div>
            {momentType.description && (
              <div className="text-xs text-muted-foreground truncate">{momentType.description}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {existingRule && !isEditing && (
            <Badge variant="secondary" className="text-[10px]">
              {existingRule.conditions.length} condition{existingRule.conditions.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {!isEditing && existingRule && (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this moment rule?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All conditions for "{momentType.name}" will be removed. Existing moments already created for people won't be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isEditing ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span>Fires when</span>
              <Select value={combinator} onValueChange={(v) => setCombinator(v as 'AND' | 'OR')}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">ALL</SelectItem>
                  <SelectItem value="OR">ANY</SelectItem>
                </SelectContent>
              </Select>
              <span>of the following are true:</span>
            </div>

            <div className="space-y-2">
              {topLevel.map((c) => {
                const idx = conditions.indexOf(c);
                return renderConditionRow(c, idx);
              })}
            </div>

            {subGroupIds.map((gid) => (
              <div key={gid} className="rounded-md border border-dashed p-3 space-y-2 bg-muted/20">
                <div className="text-xs font-medium text-muted-foreground">
                  {innerCombinator === 'OR' ? 'ANY of these (OR group)' : 'ALL of these (AND group)'}
                </div>
                {(groups.get(gid) ?? []).map((c) => {
                  const idx = conditions.indexOf(c);
                  return renderConditionRow(c, idx);
                })}
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addCondition(gid)}>
                    <Plus className="h-3 w-3 mr-1" /> Add condition
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() =>
                      setConditions((prev) => prev.filter((c) => c.condition_group !== gid))
                    }
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Remove group
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => addCondition(0)}>
                <Plus className="h-3 w-3 mr-1" /> Add condition
              </Button>
              <Button size="sm" variant="outline" onClick={() => addCondition(nextGroupId())}>
                <Plus className="h-3 w-3 mr-1" /> Add {combinator === 'AND' ? 'OR' : 'AND'} group
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!canSave || saveRule.isPending}>
                {saveRule.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                <Check className="h-3 w-3 mr-1" /> Save rule
              </Button>
            </div>
          </div>
        ) : existingRule ? (
          <div className="space-y-2 text-sm">
            <div className="text-xs text-muted-foreground">
              Fires when <span className="font-medium text-foreground">
                {existingRule.combinator === 'AND' ? 'ALL' : 'ANY'}
              </span> of the following are true:
            </div>
            <ul className="space-y-1">
              {existingRule.conditions
                .filter((c) => c.condition_group === 0)
                .map((c, i) => (
                  <li key={`t-${i}`} className="text-xs pl-3 border-l-2 border-primary/40">
                    {summaryLine(c)}
                  </li>
                ))}
            </ul>
            {Array.from(new Set(existingRule.conditions.map((c) => c.condition_group)))
              .filter((g) => g !== 0)
              .sort((a, b) => a - b)
              .map((gid) => (
                <div key={gid} className="rounded-md border border-dashed p-2 bg-muted/20">
                  <div className="text-[10px] font-medium text-muted-foreground mb-1">
                    {existingRule.combinator === 'AND' ? 'ANY of these' : 'ALL of these'}
                  </div>
                  <ul className="space-y-1">
                    {existingRule.conditions
                      .filter((c) => c.condition_group === gid)
                      .map((c, i) => (
                        <li key={`g-${gid}-${i}`} className="text-xs pl-3 border-l-2 border-primary/30">
                          {summaryLine(c)}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

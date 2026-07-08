import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, RefreshCw, Info, Settings, Plus } from "lucide-react";
import { useFlowMomentTypes } from "@/hooks/useFlowMomentTypes";
import { usePcoMomentMappings, type MomentRule } from "@/hooks/usePcoMomentMappings";
import { usePcoCustomFields } from "@/hooks/usePcoCustomFields";
import { MomentRuleCard } from "@/components/flow-moments/MomentRuleCard";
import { MomentTypeManager } from "@/components/flow-moments/MomentTypeManager";
import { iconMap } from "@/lib/flowIcons";

interface FlowMomentsMappingSectionProps {
  integrationId: string;
  organizationId: string;
}

export function FlowMomentsMappingSection({
  integrationId,
  organizationId,
}: FlowMomentsMappingSectionProps) {
  const [showMomentTypeManager, setShowMomentTypeManager] = useState(false);
  const [newMomentTypeId, setNewMomentTypeId] = useState<string | null>(null);

  const { momentTypes, isLoading: momentTypesLoading, seedDefaultTypes } = useFlowMomentTypes();
  const { mappings, isLoading: mappingsLoading } = usePcoMomentMappings(integrationId);
  const { fields, isLoading: fieldsLoading, refreshFields } = usePcoCustomFields(integrationId);

  const isLoading = momentTypesLoading || mappingsLoading || fieldsLoading;

  // Build rules grouped by moment type id
  const rulesByMomentTypeId = useMemo(() => {
    const map = new Map<string, MomentRule>();
    for (const m of mappings) {
      const rule = map.get(m.flow_moment_type_id) ?? {
        momentTypeId: m.flow_moment_type_id,
        combinator: (m.rule_combinator as 'AND' | 'OR') ?? 'AND',
        conditions: [],
      };
      rule.combinator = (m.rule_combinator as 'AND' | 'OR') ?? rule.combinator;
      rule.conditions.push({
        fieldId: m.pco_source_identifier,
        fieldLabel: m.pco_source_label,
        tabName: m.pco_tab_name ?? undefined,
        operator: m.trigger_condition?.operator ?? '',
        value: m.trigger_condition?.value ?? null,
        condition_group: m.condition_group ?? 0,
      });
      map.set(m.flow_moment_type_id, rule);
    }
    return map;
  }, [mappings]);

  const totalFieldsCount = fields.reduce((sum, tab) => sum + tab.fields.length, 0);

  const unmappedMomentTypes = momentTypes.filter(
    (mt) => !rulesByMomentTypeId.has(mt.id) && mt.id !== newMomentTypeId
  );

  const handleSeedDefaults = async () => {
    if (momentTypes.length === 0) {
      await seedDefaultTypes.mutateAsync();
    }
  };

  const rulesList = Array.from(rulesByMomentTypeId.values());
  const newMomentType = newMomentTypeId ? momentTypes.find((m) => m.id === newMomentTypeId) : null;

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Each Moment can have several PCO field conditions combined with AND / OR. When a person's
          fields satisfy the rule, a Flow Moment is created on the next sync.
        </AlertDescription>
      </Alert>

      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={() => refreshFields.mutate()}
          disabled={refreshFields.isPending}
          size="sm"
        >
          {refreshFields.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Fields from PCO
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowMomentTypeManager(true)}>
          <Settings className="h-4 w-4 mr-2" />
          Manage Moment Types
        </Button>
        {momentTypes.length === 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSeedDefaults}
            disabled={seedDefaultTypes.isPending}
          >
            {seedDefaultTypes.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Default Moment Types
          </Button>
        )}
      </div>

      <div className="flex gap-4">
        <div className="flex-1 text-center p-3 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold">{totalFieldsCount}</div>
          <div className="text-xs text-muted-foreground">PCO Fields</div>
        </div>
        <div className="flex-1 text-center p-3 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold">{momentTypes.length}</div>
          <div className="text-xs text-muted-foreground">Moment Types</div>
        </div>
        <div className="flex-1 text-center p-3 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold">{rulesByMomentTypeId.size}</div>
          <div className="text-xs text-muted-foreground">Active Rules</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Moment Rules</CardTitle>
          <CardDescription>
            Add a rule per Moment and combine multiple PCO field conditions. Example: fire "Leader
            Ready" when Baptism Date, Joined Church, and Team all have values.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No PCO custom fields found. Click "Refresh Fields from PCO" to fetch them.
            </div>
          ) : (
            <div className="space-y-4">
              {rulesList.length === 0 && !newMomentType && (
                <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-md">
                  No rules yet. Add your first Moment rule below.
                </div>
              )}

              {rulesList.map((rule) => {
                const mt = momentTypes.find((m) => m.id === rule.momentTypeId);
                if (!mt) return null;
                return (
                  <MomentRuleCard
                    key={rule.momentTypeId}
                    momentType={mt}
                    existingRule={rule}
                    tabs={fields}
                    integrationId={integrationId}
                    organizationId={organizationId}
                  />
                );
              })}

              {newMomentType && (
                <MomentRuleCard
                  key={`new-${newMomentType.id}`}
                  momentType={newMomentType}
                  tabs={fields}
                  integrationId={integrationId}
                  organizationId={organizationId}
                  startInEdit
                  onCancelNew={() => setNewMomentTypeId(null)}
                />
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={unmappedMomentTypes.length === 0}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Moment Rule
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                  {unmappedMomentTypes.map((mt) => {
                    const Icon = mt.icon ? iconMap[mt.icon] : null;
                    return (
                      <DropdownMenuItem
                        key={mt.id}
                        onClick={() => setNewMomentTypeId(mt.id)}
                      >
                        {Icon && (
                          <Icon
                            className="h-4 w-4 mr-2"
                            style={{ color: mt.color || undefined }}
                          />
                        )}
                        {mt.name}
                      </DropdownMenuItem>
                    );
                  })}
                  {unmappedMomentTypes.length === 0 && (
                    <DropdownMenuItem disabled>All moment types have rules</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </CardContent>
      </Card>

      <MomentTypeManager
        open={showMomentTypeManager}
        onOpenChange={setShowMomentTypeManager}
      />
    </div>
  );
}

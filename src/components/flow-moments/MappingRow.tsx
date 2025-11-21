import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Check, X, Save, Trash2 } from "lucide-react";
import { usePcoMomentMappings } from "@/hooks/usePcoMomentMappings";
import type { FlowMomentType } from "@/hooks/useFlowMomentTypes";
import { iconMap } from "@/lib/flowIcons";
import { getOperatorsForFieldType, needsValueInput, getOperatorLabel } from "@/lib/pcoFieldOperators";

interface MappingRowProps {
  field: {
    id: string;
    name: string;
    tabName: string;
    dataType: string;
    options: string[];
  };
  mapping: any;
  momentTypes: FlowMomentType[];
  integrationId: string;
  organizationId: string;
}

export function MappingRow({ field, mapping, momentTypes, integrationId, organizationId }: MappingRowProps) {
  const { createMapping, updateMapping, deleteMapping } = usePcoMomentMappings(integrationId);
  
  // Convert stored format to display format for yes/no fields
  const getInitialOperator = () => {
    if (!mapping || field.dataType !== 'yes_no') {
      return mapping?.trigger_condition?.operator || "equals";
    }
    // For yes/no fields, convert: equals+Yes -> is_yes, equals+No -> is_no
    const storedValue = mapping.trigger_condition?.value;
    if (storedValue === 'Yes') return 'is_yes';
    if (storedValue === 'No') return 'is_no';
    return 'is_yes'; // default
  };

  const [isEditing, setIsEditing] = useState(!mapping);
  const [selectedMomentTypeId, setSelectedMomentTypeId] = useState(mapping?.flow_moment_type_id || "");
  const [selectedOperator, setSelectedOperator] = useState(getInitialOperator());
  const [triggerValue, setTriggerValue] = useState(mapping?.trigger_condition?.value || "Yes");

  const availableOperators = getOperatorsForFieldType(field.dataType);
  const showValueInput = needsValueInput(selectedOperator);

  const handleSave = async () => {
    if (!selectedMomentTypeId) return;

    // Convert display format to storage format for yes/no fields
    let finalOperator = selectedOperator;
    let finalValue = triggerValue;
    
    if (field.dataType === 'yes_no') {
      if (selectedOperator === 'is_yes') {
        finalOperator = 'equals';
        finalValue = 'Yes';
      } else if (selectedOperator === 'is_no') {
        finalOperator = 'equals';
        finalValue = 'No';
      }
    }

    const mappingData = {
      organization_id: organizationId,
      integration_id: integrationId,
      pco_source_type: 'custom_tab_field' as const,
      pco_source_identifier: field.id,
      pco_source_label: field.name,
      pco_tab_name: field.tabName,
      flow_moment_type_id: selectedMomentTypeId,
      trigger_condition: {
        operator: finalOperator,
        value: finalValue,
      },
      is_active: true,
    };

    if (mapping) {
      await updateMapping.mutateAsync({ id: mapping.id, data: mappingData });
    } else {
      await createMapping.mutateAsync(mappingData);
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (mapping) {
      await deleteMapping.mutateAsync(mapping.id);
    }
  };

  const selectedMomentType = momentTypes.find(mt => mt.id === selectedMomentTypeId);
  const IconComponent = selectedMomentType?.icon ? iconMap[selectedMomentType.icon] : null;

  return (
    <div className="grid grid-cols-10 gap-4 px-4 py-3 border rounded-lg hover:bg-muted/30 transition-colors">
      {/* Field Name */}
      <div className="col-span-4 flex items-center">
        <span className="text-sm font-medium truncate">{field.name}</span>
      </div>

      {/* Moment Type */}
      <div className="col-span-3 flex items-center">
        {isEditing ? (
          <Select value={selectedMomentTypeId} onValueChange={setSelectedMomentTypeId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select moment type" />
            </SelectTrigger>
            <SelectContent>
              {momentTypes.map((mt) => {
                const Icon = mt.icon ? iconMap[mt.icon] : null;
                return (
                  <SelectItem key={mt.id} value={mt.id}>
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className="h-3 w-3" style={{ color: mt.color || undefined }} />}
                      <span>{mt.name}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        ) : mapping ? (
          <div className="flex items-center gap-2">
            {IconComponent && (
              <IconComponent 
                className="h-3 w-3" 
                style={{ color: mapping.flow_moment_types?.color || undefined }} 
              />
            )}
            <span className="text-sm">{mapping.flow_moment_types?.name || 'Unknown'}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Not mapped</span>
        )}
      </div>

      {/* Trigger */}
      <div className="col-span-2 flex items-center gap-2">
        {isEditing ? (
          <>
            {/* Operator Selection */}
            <Select value={selectedOperator} onValueChange={setSelectedOperator}>
              <SelectTrigger className="h-8 text-xs w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableOperators.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Value Input (only if operator needs value) */}
            {showValueInput && (
              field.dataType === 'yes_no' ? (
                <Select value={triggerValue} onValueChange={setTriggerValue}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Select value" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              ) : field.options.length > 0 ? (
                <Select value={triggerValue} onValueChange={setTriggerValue}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Value" />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={triggerValue}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  placeholder="Value"
                  className="h-8 text-xs flex-1"
                  type={field.dataType === 'number' ? 'number' : 'text'}
                />
              )
            )}
          </>
        ) : mapping ? (
          <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
            {field.dataType === 'yes_no' 
              ? getOperatorLabel(mapping.trigger_condition?.value === 'Yes' ? 'is_yes' : 'is_no')
              : `${getOperatorLabel(mapping.trigger_condition?.operator)}${needsValueInput(mapping.trigger_condition?.operator) ? ` "${mapping.trigger_condition?.value}"` : ''}`
            }
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </div>

      {/* Status & Actions */}
      <div className="col-span-1 flex items-center justify-end gap-2">
        {isEditing ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={handleSave}
              disabled={!selectedMomentTypeId || createMapping.isPending || updateMapping.isPending}
            >
              <Save className="h-3 w-3" />
            </Button>
            {mapping && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setIsEditing(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ) : (
          <>
            <Badge variant="default" className="text-xs">
              <Check className="h-3 w-3 mr-1" />
              Mapped
            </Badge>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setIsEditing(true)}
              >
                <Save className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive"
                onClick={handleDelete}
                disabled={deleteMapping.isPending}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

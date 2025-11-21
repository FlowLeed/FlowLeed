import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Check, X, Save, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { usePcoMomentMappings } from "@/hooks/usePcoMomentMappings";
import type { FlowMomentType } from "@/hooks/useFlowMomentTypes";
import { iconMap } from "@/lib/flowIcons";
import { 
  getCombinedOptionsForField, 
  needsAdditionalInput, 
  encodeTriggerCondition, 
  decodeTriggerCondition,
  getTriggerLabel 
} from "@/lib/pcoFieldOperators";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  
  // Decode existing mapping into combined dropdown format
  const initialDecoded = mapping 
    ? decodeTriggerCondition(
        mapping.trigger_condition?.operator || '',
        mapping.trigger_condition?.value || null,
        field
      )
    : { selectedValue: '', additionalValue: null };
  
  const [isEditing, setIsEditing] = useState(!mapping);
  const [selectedMomentTypeId, setSelectedMomentTypeId] = useState(mapping?.flow_moment_type_id || "");
  const [selectedTrigger, setSelectedTrigger] = useState(initialDecoded.selectedValue);
  const [additionalValue, setAdditionalValue] = useState(initialDecoded.additionalValue || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    field.dataType === 'date' && initialDecoded.additionalValue 
      ? new Date(initialDecoded.additionalValue) 
      : undefined
  );

  const triggerOptions = getCombinedOptionsForField({
    dataType: field.dataType,
    options: field.options || [],
  });

  const handleSave = async () => {
    if (!selectedMomentTypeId || !selectedTrigger) return;

    // Prepare additional value based on field type
    let finalAdditionalValue = additionalValue;
    if (field.dataType === 'date' && selectedDate) {
      finalAdditionalValue = format(selectedDate, 'yyyy-MM-dd');
    }

    // Encode the combined dropdown selection back to database format
    const triggerCondition = encodeTriggerCondition(selectedTrigger, finalAdditionalValue);

    const mappingData = {
      organization_id: organizationId,
      integration_id: integrationId,
      pco_source_type: 'custom_tab_field' as const,
      pco_source_identifier: field.id,
      pco_source_label: field.name,
      pco_tab_name: field.tabName,
      flow_moment_type_id: selectedMomentTypeId,
      trigger_condition: triggerCondition,
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
      <div className="col-span-2 flex flex-col gap-2">
        {isEditing ? (
          <>
            <Select value={selectedTrigger} onValueChange={setSelectedTrigger}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select trigger..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {triggerOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Show additional input when needed */}
            {needsAdditionalInput(selectedTrigger, field.dataType) && (
              <>
                {field.dataType === 'date' ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-8 text-xs justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {selectedDate ? format(selectedDate, "PPP") : <span>Pick date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Input
                    value={additionalValue}
                    onChange={(e) => setAdditionalValue(e.target.value)}
                    placeholder="Enter value"
                    className="h-8 text-xs"
                    type={field.dataType === 'number' ? 'number' : 'text'}
                  />
                )}
              </>
            )}
          </>
        ) : mapping ? (
          <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
            {getTriggerLabel(
              decodeTriggerCondition(
                mapping.trigger_condition?.operator || '',
                mapping.trigger_condition?.value || null,
                field
              ).selectedValue,
              decodeTriggerCondition(
                mapping.trigger_condition?.operator || '',
                mapping.trigger_condition?.value || null,
                field
              ).additionalValue
            )}
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

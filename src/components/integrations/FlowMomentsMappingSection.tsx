import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, Info, Settings } from "lucide-react";
import { useFlowMomentTypes } from "@/hooks/useFlowMomentTypes";
import { usePcoMomentMappings } from "@/hooks/usePcoMomentMappings";
import { usePcoCustomFields } from "@/hooks/usePcoCustomFields";
import { MappingRow } from "@/components/flow-moments/MappingRow";
import { MomentTypeManager } from "@/components/flow-moments/MomentTypeManager";

interface FlowMomentsMappingSectionProps {
  integrationId: string;
  organizationId: string;
}

export function FlowMomentsMappingSection({ 
  integrationId, 
  organizationId 
}: FlowMomentsMappingSectionProps) {
  const [showMomentTypeManager, setShowMomentTypeManager] = useState(false);
  
  const { momentTypes, isLoading: momentTypesLoading, seedDefaultTypes } = useFlowMomentTypes();
  const { mappings, isLoading: mappingsLoading } = usePcoMomentMappings(integrationId);
  const { fields, isLoading: fieldsLoading, refreshFields } = usePcoCustomFields(integrationId);

  const isLoading = momentTypesLoading || mappingsLoading || fieldsLoading;

  // Get all fields from all tabs
  const allFields = fields.flatMap(tab => 
    tab.fields.map(field => ({
      ...field,
      tabName: tab.tabName,
    }))
  );

  // Map field IDs to existing mappings
  const mappingByFieldId = new Map();
  mappings.forEach(mapping => {
    mappingByFieldId.set(mapping.pco_source_identifier, mapping);
  });

  const handleSeedDefaults = async () => {
    if (momentTypes.length === 0) {
      await seedDefaultTypes.mutateAsync();
    }
  };

  return (
    <div className="space-y-4">
      {/* Info Box */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Every church names things differently. Use this section to tell FlowLeed which Planning Center
          tabs/fields represent key moments like Salvation, Baptism, or Join the Church. We'll do the
          rest during sync.
        </AlertDescription>
      </Alert>

      {/* Actions */}
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMomentTypeManager(true)}
        >
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

      {/* Stats */}
      <div className="flex gap-4">
        <div className="flex-1 text-center p-3 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold">{allFields.length}</div>
          <div className="text-xs text-muted-foreground">PCO Fields</div>
        </div>
        <div className="flex-1 text-center p-3 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold">{momentTypes.length}</div>
          <div className="text-xs text-muted-foreground">Moment Types</div>
        </div>
        <div className="flex-1 text-center p-3 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold">{mappings.length}</div>
          <div className="text-xs text-muted-foreground">Active Mappings</div>
        </div>
      </div>

      {/* Mappings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Field Mappings</CardTitle>
          <CardDescription>
            Map PCO custom fields to Flow Moment Types. When a field value matches your trigger condition,
            a Flow Moment will be created for that person.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : allFields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No custom fields found. Click "Refresh Fields from PCO" to fetch them.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-muted/50 rounded-lg font-medium text-sm">
                <div className="col-span-2">Tab</div>
                <div className="col-span-3">Field Name</div>
                <div className="col-span-3">Moment Type</div>
                <div className="col-span-2">Trigger</div>
                <div className="col-span-2">Status</div>
              </div>
              
              {/* Table Rows */}
              {allFields.map((field) => (
                <MappingRow
                  key={field.id}
                  field={field}
                  mapping={mappingByFieldId.get(field.id)}
                  momentTypes={momentTypes}
                  integrationId={integrationId}
                  organizationId={organizationId}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Moment Type Manager Dialog */}
      <MomentTypeManager
        open={showMomentTypeManager}
        onOpenChange={setShowMomentTypeManager}
      />
    </div>
  );
}

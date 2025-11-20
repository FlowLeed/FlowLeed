import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Info, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFlowMomentTypes } from "@/hooks/useFlowMomentTypes";
import { usePcoMomentMappings } from "@/hooks/usePcoMomentMappings";
import { usePcoCustomFields } from "@/hooks/usePcoCustomFields";
import { MappingRow } from "@/components/flow-moments/MappingRow";
import { MomentTypeManager } from "@/components/flow-moments/MomentTypeManager";

export default function FlowMomentsMappingPage() {
  const { user } = useAuth();
  const [showMomentTypeManager, setShowMomentTypeManager] = useState(false);
  
  // Get user's organization and PCO integration
  const { data: orgData } = useQuery({
    queryKey: ['user-org-integration', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .single();
      
      if (!member) return null;
      
      const { data: integration } = await supabase
        .from('integrations')
        .select('*')
        .eq('organization_id', member.organization_id)
        .eq('service_name', 'planning_center')
        .eq('status', 'active')
        .single();
      
      return { organization_id: member.organization_id, integration, role: member.role };
    },
    enabled: !!user?.id,
  });

  const { momentTypes, isLoading: momentTypesLoading, seedDefaultTypes } = useFlowMomentTypes();
  const { mappings, isLoading: mappingsLoading } = usePcoMomentMappings(orgData?.integration?.id);
  const { fields, isLoading: fieldsLoading, refreshFields } = usePcoCustomFields(orgData?.integration?.id);

  const isAdmin = orgData?.role === 'owner' || orgData?.role === 'admin';

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertDescription>Please log in to access this page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>Only administrators can manage flow moment mappings.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!orgData?.integration) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Please connect your Planning Center account first in the Integrations page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

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
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Flow Moments Mapping</h1>
        <p className="text-muted-foreground mt-2">
          Map Planning Center custom tabs and fields to Flow Moments
        </p>
      </div>

      {/* Info Box */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Every church names things differently. Use this page to tell FlowLeed which Planning Center
          tabs/fields represent key moments like Salvation, Baptism, or Join the Church. We'll do the
          rest during sync.
        </AlertDescription>
      </Alert>

      {/* Actions */}
      <div className="flex gap-4">
        <Button
          onClick={() => refreshFields.mutate()}
          disabled={refreshFields.isPending}
        >
          {refreshFields.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Fields from PCO
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowMomentTypeManager(true)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Manage Moment Types
        </Button>
        {momentTypes.length === 0 && (
          <Button
            variant="secondary"
            onClick={handleSeedDefaults}
            disabled={seedDefaultTypes.isPending}
          >
            {seedDefaultTypes.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Default Moment Types
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              PCO Custom Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allFields.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Moment Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{momentTypes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Mappings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mappings.length}</div>
          </CardContent>
        </Card>
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
                  integrationId={orgData.integration.id}
                  organizationId={orgData.organization_id}
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

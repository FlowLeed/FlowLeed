import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FlowMomentsMappingSection } from "@/components/integrations/FlowMomentsMappingSection";
import { ArrowLeft, Settings } from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

const IntegrationAdvancedSettingsPage = () => {
  const { integrationName } = useParams<{ integrationName: string }>();
  const navigate = useNavigate();

  // Get organization ID
  const { data: userOrgData } = useQuery({
    queryKey: ['user-organization'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      return data;
    }
  });

  // Fetch integration
  const { data: integration, isLoading } = useQuery({
    queryKey: ['integration', integrationName, userOrgData?.organization_id],
    enabled: !!userOrgData?.organization_id && !!integrationName,
    queryFn: async () => {
      const serviceName = integrationName?.replace('-', '_');
      const { data, error } = await supabase
        .from('integrations')
        .select('id, organization_id, user_id, service_name, status, metadata, sync_frequency, last_sync_at, auto_sync_all_people, provider_account_name, oauth_scopes, created_at, updated_at')
        .eq('service_name', serviceName)
        .eq('organization_id', userOrgData!.organization_id)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const getIntegrationDisplayName = (name?: string) => {
    if (!name) return '';
    return name.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Header 
          title="Advanced Settings" 
          description="Loading integration settings..."
        />
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="container mx-auto py-8">
        <Header 
          title="Integration Not Found" 
          description="The requested integration could not be found."
        />
        <Button onClick={() => navigate('/integrations')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Integrations
        </Button>
      </div>
    );
  }

  const displayName = getIntegrationDisplayName(integrationName);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="container mx-auto py-8 space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/integrations')} className="cursor-pointer">
              Integrations
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/integrations')} className="cursor-pointer">
              {displayName}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbPage>Advanced Settings</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">{displayName} Advanced Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Configure advanced settings and mappings for your {displayName} integration
          </p>
        </div>
        {getStatusBadge(integration.status)}
      </div>

      <Separator />

      {/* Integration-specific Advanced Settings */}
      {integrationName === 'planning-center' && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Field Mappings</CardTitle>
            <CardDescription>
              Map Planning Center custom tabs and fields to Flow Moment Types for automated event creation during sync
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FlowMomentsMappingSection
              integrationId={integration.id}
              organizationId={userOrgData!.organization_id}
            />
          </CardContent>
        </Card>
      )}

      {integrationName === 'twilio' && (
        <Card>
          <CardHeader>
            <CardTitle>Twilio Advanced Settings</CardTitle>
            <CardDescription>
              Advanced configuration options for your Twilio integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Twilio advanced settings coming soon...</p>
          </CardContent>
        </Card>
      )}

      {/* Back button */}
      <div className="pt-4">
        <Button variant="outline" onClick={() => navigate('/integrations')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Integrations
        </Button>
      </div>
    </div>
    </div>
  );
};

export default IntegrationAdvancedSettingsPage;

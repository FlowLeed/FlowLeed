import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useIntegrations } from "@/hooks/useIntegrations";
import PlanningCenterListsTab from "@/components/integrations/PlanningCenterListsTab";
import SecretsManagement from "@/components/integrations/SecretsManagement";
import { ArrowLeft, Settings2, CheckCircle, AlertCircle, ExternalLink, Key, Database, Calendar, Mail, Users, Zap, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const IntegrationsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    integrations,
    loading,
    connectPlanningCenter,
    testConnection,
    syncData,
    disconnect,
    isConnected
  } = useIntegrations();
  
  const [planningCenterForm, setPlanningCenterForm] = useState({
    appId: "",
    secret: ""
  });

  const handlePlanningCenterConnect = async () => {
    if (!planningCenterForm.appId || !planningCenterForm.secret) {
      toast({
        title: "Error",
        description: "Please enter both App ID and Secret",
        variant: "destructive",
      });
      return;
    }

    await connectPlanningCenter(planningCenterForm.appId, planningCenterForm.secret);
    setPlanningCenterForm({ appId: "", secret: "" });
  };

  const handleTest = (serviceName: string) => {
    testConnection(serviceName);
  };

  const handleSync = (serviceName: string) => {
    syncData(serviceName);
  };

  const handleDisconnect = (serviceName: string) => {
    disconnect(serviceName);
  };

  const getStatusBadge = (serviceName: string) => {
    const integration = integrations.find(i => i.service_name === serviceName);
    
    if (loading) {
      return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing...</Badge>;
    }
    
    switch (integration?.status) {
      case "connected":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">Not Connected</Badge>;
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">Connect and manage your external tools and services</p>
        </div>
      </div>

      <Tabs defaultValue="available" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="secrets">Secrets</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
          <TabsTrigger value="connected">Connected</TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-6">
          {/* Planning Center Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Database className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Planning Center</CardTitle>
                    <CardDescription>Sync church management data and member information</CardDescription>
                  </div>
                </div>
                {getStatusBadge('planning_center')}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Planning Center account to automatically sync member data, groups, and event information.
              </p>
              
              {!isConnected('planning_center') ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="pc-app-id">Application ID</Label>
                    <Input
                      id="pc-app-id"
                      placeholder="Enter your Planning Center App ID"
                      value={planningCenterForm.appId}
                      onChange={(e) => setPlanningCenterForm(prev => ({ ...prev, appId: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pc-secret">Secret</Label>
                    <Input
                      id="pc-secret"
                      type="password"
                      placeholder="Enter your Planning Center Secret"
                      value={planningCenterForm.secret}
                      onChange={(e) => setPlanningCenterForm(prev => ({ ...prev, secret: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handlePlanningCenterConnect}
                      disabled={loading || !planningCenterForm.appId || !planningCenterForm.secret}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        'Connect Planning Center'
                      )}
                    </Button>
                    <Button variant="outline" asChild>
                      <a href="https://api.planningcenteronline.com/" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Get API Keys
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    variant="destructive" 
                    onClick={() => handleDisconnect('planning_center')}
                    disabled={loading}
                  >
                    Disconnect
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleTest('planning_center')}
                    disabled={loading}
                  >
                    Test Connection
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleSync('planning_center')}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Sync Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mailchimp Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <CardTitle>Mailchimp</CardTitle>
                    <CardDescription>Sync email marketing lists and campaigns</CardDescription>
                  </div>
                </div>
                <Badge variant="outline">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect Mailchimp to automatically sync your contact lists and manage email campaigns.
              </p>
              
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Mailchimp integration is coming soon. Stay tuned for email marketing automation features.
                </p>
                <Button disabled variant="outline">
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Zapier Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle>Zapier</CardTitle>
                    <CardDescription>Automate workflows with 6000+ apps</CardDescription>
                  </div>
                </div>
                <Badge variant="outline">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect Zapier to trigger automated workflows when contacts move through your pipelines.
              </p>
              
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Zapier integration is coming soon. Automate your workflows with thousands of apps.
                </p>
                <Button disabled variant="outline">
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Google Calendar Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Google Calendar</CardTitle>
                    <CardDescription>Sync events and schedule follow-ups</CardDescription>
                  </div>
                </div>
                <Badge variant="outline">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect Google Calendar to automatically create follow-up events and sync meeting schedules.
              </p>
              
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Google Calendar integration is coming soon. Schedule follow-ups and sync events automatically.
                </p>
                <Button disabled variant="outline">
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connected" className="space-y-6">
          <div className="grid gap-4">
            {integrations
              .filter(integration => integration.status === 'connected')
              .map((integration) => (
                <Card key={integration.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <CardTitle className="capitalize">
                            {integration.service_name.replace(/_/g, ' ')}
                          </CardTitle>
                          <CardDescription>
                            Connected{integration.last_sync_at && ` • Last sync: ${new Date(integration.last_sync_at).toLocaleDateString()}`}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSync(integration.service_name)}
                          disabled={loading}
                        >
                          Sync Now
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleDisconnect(integration.service_name)}
                          disabled={loading}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            
            {integrations.filter(i => i.status === 'connected').length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Connected Services</h3>
                  <p className="text-muted-foreground mb-4">
                    Connect your favorite tools to streamline your workflow
                  </p>
                  <Button onClick={() => window.location.hash = '#available'}>
                    Browse Integrations
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="secrets" className="space-y-6">
          <SecretsManagement />
        </TabsContent>

        <TabsContent value="lists">
          <PlanningCenterListsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegrationsPage;
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
import { ArrowLeft, Settings2, CheckCircle, AlertCircle, ExternalLink, Key, Database, Calendar, Mail, Users, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ListMappingManager } from "@/components/integrations/ListMappingManager";
import { ListToStageMappingDialog } from "@/components/integrations/ListToStageMappingDialog";

const IntegrationsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('');
  
  const [connections, setConnections] = useState({
    planningCenter: {
      connected: false,
      apiKey: "",
      secret: "",
      appId: "",
      status: "disconnected"
    },
    mailchimp: {
      connected: false,
      apiKey: "",
      status: "disconnected"
    },
    zapier: {
      connected: false,
      webhookUrl: "",
      status: "disconnected"
    },
    googleCalendar: {
      connected: false,
      status: "disconnected"
    }
  });

  const handleConnect = async (service: string) => {
    // Simulate connection process
    setConnections(prev => ({
      ...prev,
      [service]: {
        ...prev[service as keyof typeof prev],
        status: "connecting"
      }
    }));

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    setConnections(prev => ({
      ...prev,
      [service]: {
        ...prev[service as keyof typeof prev],
        connected: true,
        status: "connected"
      }
    }));

    toast({
      title: "Integration Connected",
      description: `Successfully connected to ${service}`,
    });
  };

  const handleDisconnect = (service: string) => {
    setConnections(prev => ({
      ...prev,
      [service]: {
        ...prev[service as keyof typeof prev],
        connected: false,
        status: "disconnected"
      }
    }));

    toast({
      title: "Integration Disconnected",
      description: `Disconnected from ${service}`,
      variant: "destructive",
    });
  };

  const handleInputChange = (service: string, field: string, value: string) => {
    setConnections(prev => ({
      ...prev,
      [service]: {
        ...prev[service as keyof typeof prev],
        [field]: value
      }
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
      case "connecting":
        return <Badge variant="secondary">Connecting...</Badge>;
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="available">Available Integrations</TabsTrigger>
          <TabsTrigger value="connected">Connected Services</TabsTrigger>
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
                {getStatusBadge(connections.planningCenter.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Planning Center account to automatically sync member data, groups, and event information.
              </p>
              
              {!connections.planningCenter.connected ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="pc-app-id">Application ID</Label>
                    <Input
                      id="pc-app-id"
                      placeholder="Enter your Planning Center App ID"
                      value={connections.planningCenter.appId}
                      onChange={(e) => handleInputChange('planningCenter', 'appId', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pc-secret">Secret</Label>
                    <Input
                      id="pc-secret"
                      type="password"
                      placeholder="Enter your Planning Center Secret"
                      value={connections.planningCenter.secret}
                      onChange={(e) => handleInputChange('planningCenter', 'secret', e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleConnect('planningCenter')}
                      disabled={!connections.planningCenter.appId || !connections.planningCenter.secret}
                    >
                      Connect Planning Center
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
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button variant="destructive" onClick={() => handleDisconnect('planningCenter')}>
                      Disconnect
                    </Button>
                    <Button variant="outline">Test Connection</Button>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-3">
                    <h4 className="font-medium">List Mappings</h4>
                    <p className="text-sm text-muted-foreground">
                      Map Planning Center lists to specific CRM pipeline stages to automatically sync contacts.
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSelectedIntegrationId('planning-center-integration');
                        setMappingDialogOpen(true);
                      }}
                    >
                      Manage List Mappings
                    </Button>
                  </div>
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
                {getStatusBadge(connections.mailchimp.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect Mailchimp to automatically sync your contact lists and manage email campaigns.
              </p>
              
              {!connections.mailchimp.connected ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="mc-api-key">API Key</Label>
                    <Input
                      id="mc-api-key"
                      type="password"
                      placeholder="Enter your Mailchimp API Key"
                      value={connections.mailchimp.apiKey}
                      onChange={(e) => handleInputChange('mailchimp', 'apiKey', e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleConnect('mailchimp')}
                      disabled={!connections.mailchimp.apiKey}
                    >
                      Connect Mailchimp
                    </Button>
                    <Button variant="outline" asChild>
                      <a href="https://mailchimp.com/developer/marketing/guides/quick-start/#generate-your-api-key" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Get API Key
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={() => handleDisconnect('mailchimp')}>
                    Disconnect
                  </Button>
                  <Button variant="outline">Test Connection</Button>
                </div>
              )}
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
                {getStatusBadge(connections.zapier.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect Zapier to trigger automated workflows when contacts move through your pipelines.
              </p>
              
              {!connections.zapier.connected ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="zapier-webhook">Webhook URL</Label>
                    <Input
                      id="zapier-webhook"
                      placeholder="Enter your Zapier webhook URL"
                      value={connections.zapier.webhookUrl}
                      onChange={(e) => handleInputChange('zapier', 'webhookUrl', e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleConnect('zapier')}
                      disabled={!connections.zapier.webhookUrl}
                    >
                      Connect Zapier
                    </Button>
                    <Button variant="outline" asChild>
                      <a href="https://zapier.com/apps/webhook/integrations" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Create Webhook
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={() => handleDisconnect('zapier')}>
                    Disconnect
                  </Button>
                  <Button variant="outline">Test Webhook</Button>
                </div>
              )}
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
                {getStatusBadge(connections.googleCalendar.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect Google Calendar to automatically create follow-up events and sync meeting schedules.
              </p>
              
              {!connections.googleCalendar.connected ? (
                <Button onClick={() => handleConnect('googleCalendar')}>
                  Connect with Google
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={() => handleDisconnect('googleCalendar')}>
                    Disconnect
                  </Button>
                  <Button variant="outline">Sync Now</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connected" className="space-y-6">
          <div className="grid gap-4">
            {Object.entries(connections)
              .filter(([, connection]) => connection.connected)
              .map(([service, connection]) => (
                <Card key={service}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <CardTitle className="capitalize">{service.replace(/([A-Z])/g, ' $1').trim()}</CardTitle>
                          <CardDescription>Connected and syncing</CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">Settings</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDisconnect(service)}>
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            
            {Object.values(connections).every(conn => !conn.connected) && (
              <Card>
                <CardContent className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Connected Services</h3>
                  <p className="text-muted-foreground mb-4">
                    Connect your favorite tools to streamline your workflow
                  </p>
                  <Button onClick={() => navigate('/integrations')}>
                    Browse Integrations
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <ListToStageMappingDialog
        isOpen={mappingDialogOpen}
        onOpenChange={setMappingDialogOpen}
        integrationId={selectedIntegrationId}
      />
    </div>
  );
};

export default IntegrationsPage;
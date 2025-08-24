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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ListMappingManager } from "@/components/integrations/ListMappingManager";
import { ListToStageMappingDialog } from "@/components/integrations/ListToStageMappingDialog";
import { SyncSettingsSection } from "@/components/integrations/SyncSettingsSection";
const IntegrationsPage = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [planningCenterForm, setPlanningCenterForm] = useState({
    appId: '',
    secret: ''
  });

  // Fetch existing integrations
  const {
    data: integrations,
    isLoading: integrationsLoading
  } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('integrations').select('*').eq('service_name', 'planning_center');
      if (error) throw error;
      return data;
    }
  });
  const planningCenterIntegration = integrations?.[0];
  const createIntegrationMutation = useMutation({
    mutationFn: async ({
      appId,
      secret
    }: {
      appId: string;
      secret: string;
    }) => {
      // Get user's organization
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      const {
        data: orgMember
      } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).single();
      const {
        data,
        error
      } = await supabase.from('integrations').insert({
        service_name: 'planning_center',
        status: 'active',
        credentials: {
          application_id: appId,
          secret
        },
        settings: {},
        organization_id: orgMember?.organization_id || '',
        user_id: user.id
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['integrations']
      });
      setPlanningCenterForm({
        appId: '',
        secret: ''
      });
      toast({
        title: 'Integration Connected',
        description: 'Successfully connected to Planning Center'
      });
    },
    onError: error => {
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect to Planning Center. Please check your credentials.',
        variant: 'destructive'
      });
    }
  });
  const deleteIntegrationMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const {
        error
      } = await supabase.from('integrations').delete().eq('id', integrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['integrations']
      });
      toast({
        title: 'Integration Disconnected',
        description: 'Successfully disconnected from Planning Center',
        variant: 'destructive'
      });
    }
  });
  const testConnectionMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const {
        data,
        error
      } = await supabase.functions.invoke('planning-center-lists', {
        body: {
          action: 'testConnection',
          integrationId
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: data => {
      if (data.success) {
        queryClient.invalidateQueries({
          queryKey: ['integrations']
        });
        toast({
          title: 'Connection Successful',
          description: `Connected as ${data.user?.first_name} ${data.user?.last_name}`
        });
      } else {
        throw new Error(data.error);
      }
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({
        queryKey: ['integrations']
      });
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect to Planning Center. Please check your credentials.',
        variant: 'destructive'
      });
    }
  });
  const handlePlanningCenterConnect = () => {
    createIntegrationMutation.mutate({
      appId: planningCenterForm.appId,
      secret: planningCenterForm.secret
    });
  };
  const handlePlanningCenterDisconnect = () => {
    if (planningCenterIntegration) {
      deleteIntegrationMutation.mutate(planningCenterIntegration.id);
    }
  };
  const handleTestConnection = () => {
    if (planningCenterIntegration) {
      testConnectionMutation.mutate(planningCenterIntegration.id);
    }
  };
  const handleSyncNow = async () => {
    if (!planningCenterIntegration) return;
    setIsSyncing(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('planning-center-lists', {
        body: {
          action: 'autoSync'
        }
      });
      if (error) throw error;
      if (data.success) {
        queryClient.invalidateQueries({
          queryKey: ['integrations']
        });
        queryClient.invalidateQueries({
          queryKey: ['list-mappings']
        });
        toast({
          title: 'Sync completed',
          description: data.message || 'Successfully synced all active mappings'
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Sync failed',
        description: error.message || 'Failed to sync data',
        variant: 'destructive'
      });
    } finally {
      setIsSyncing(false);
    }
  };
  const getStatusBadge = (integration: any, isLoading: boolean = false) => {
    if (isLoading) {
      return <Badge variant="secondary">Loading...</Badge>;
    }
    if (integration?.status === 'active') {
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
    }
    if (integration?.status === 'failed') {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Connection Failed</Badge>;
    }
    if (integration) {
      return <Badge variant="secondary">Not Tested</Badge>;
    }
    return <Badge variant="outline">Not Connected</Badge>;
  };
  return <div className="min-h-screen p-6 max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
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
                {getStatusBadge(planningCenterIntegration, integrationsLoading)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Automatically sync your Planning Center people into the right Flows — mapping lists to spiritual steps that drive real connection, discipleship, and next steps.</p>
              
              {!planningCenterIntegration ? <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="pc-app-id">Application ID</Label>
                    <Input id="pc-app-id" placeholder="Enter your Planning Center App ID" value={planningCenterForm.appId} onChange={e => setPlanningCenterForm(prev => ({
                  ...prev,
                  appId: e.target.value
                }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pc-secret">Secret</Label>
                    <Input id="pc-secret" type="password" placeholder="Enter your Planning Center Secret" value={planningCenterForm.secret} onChange={e => setPlanningCenterForm(prev => ({
                  ...prev,
                  secret: e.target.value
                }))} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handlePlanningCenterConnect} disabled={!planningCenterForm.appId || !planningCenterForm.secret || createIntegrationMutation.isPending}>
                      {createIntegrationMutation.isPending ? 'Connecting...' : 'Connect Planning Center'}
                    </Button>
                    <Button variant="outline" asChild>
                      <a href="https://api.planningcenteronline.com/" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Get API Keys
                      </a>
                    </Button>
                  </div>
                </div> : <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button variant="destructive" onClick={handlePlanningCenterDisconnect} disabled={deleteIntegrationMutation.isPending}>
                      {deleteIntegrationMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
                    </Button>
                    <Button variant="outline" onClick={handleTestConnection} disabled={testConnectionMutation.isPending}>
                      {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-3">
                    <h4 className="font-medium">List Mappings</h4>
                    <p className="text-sm text-muted-foreground">
                      Map Planning Center lists to specific CRM pipeline stages to automatically sync contacts.
                    </p>
                    {planningCenterIntegration?.status === 'active' ? <Button variant="outline" onClick={() => {
                  setSelectedIntegrationId(planningCenterIntegration.id);
                  setMappingDialogOpen(true);
                }}>
                        Manage List Mappings
                      </Button> : <p className="text-sm text-muted-foreground">Test connection first to enable list mapping.</p>}
                  </div>
                  
                   {planningCenterIntegration?.status === 'active' && <>
                      <Separator />
                      
                      <div className="space-y-6">
                        <SyncSettingsSection integrationId={planningCenterIntegration.id} currentFrequency={planningCenterIntegration.sync_frequency || 'every_15_minutes'} lastSyncAt={planningCenterIntegration.last_sync_at} onSyncNow={handleSyncNow} isSyncing={isSyncing} />
                        
                        <ListMappingManager integrationId={planningCenterIntegration.id} onCreateMapping={() => {
                    setSelectedIntegrationId(planningCenterIntegration.id);
                    setMappingDialogOpen(true);
                  }} />
                      </div>
                    </>}
                </div>}
            </CardContent>
          </Card>

          {/* Other integrations coming soon */}
          <Card className="opacity-50">
            <CardContent className="text-center py-8">
              <div className="flex justify-center gap-4 mb-4">
                <Mail className="h-8 w-8 text-muted-foreground" />
                <Zap className="h-8 w-8 text-muted-foreground" />
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">More Integrations Coming Soon</h3>
              <p className="text-muted-foreground">
                Mailchimp, Zapier, Google Calendar, and more integrations will be available soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connected" className="space-y-6">
          <div className="grid gap-4">
            {planningCenterIntegration ? <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <CardTitle>Planning Center</CardTitle>
                        <CardDescription>Connected and syncing</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">Settings</Button>
                      <Button variant="destructive" size="sm" onClick={handlePlanningCenterDisconnect} disabled={deleteIntegrationMutation.isPending}>
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card> : <Card>
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
              </Card>}
          </div>
        </TabsContent>
      </Tabs>

      <ListToStageMappingDialog isOpen={mappingDialogOpen} onOpenChange={setMappingDialogOpen} integrationId={selectedIntegrationId} />
    </div>;
};
export default IntegrationsPage;
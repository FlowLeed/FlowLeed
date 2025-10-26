import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Badge } from "@/components/ui/badge";

import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, ExternalLink, Key, Database, Calendar, Mail, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ListMappingManager } from "@/components/integrations/ListMappingManager";
import { QuickMappingDialog } from "@/components/integrations/QuickMappingDialog";
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
      
      // Create integration with smart defaults
      const {
        data,
        error
      } = await supabase.from('integrations').insert({
        service_name: 'planning_center',
        status: 'connecting', // Temporary status while we test
        credentials: {
          application_id: appId,
          secret
        },
        settings: {},
        sync_frequency: 'every_15_minutes', // Smart default
        organization_id: orgMember?.organization_id || '',
        user_id: user.id
      }).select().single();
      
      if (error) throw error;
      
      // Immediately test the connection
      const testResult = await supabase.functions.invoke('planning-center-lists', {
        body: {
          action: 'testConnection',
          integrationId: data.id
        }
      });
      
      if (testResult.error || !testResult.data?.success) {
        // Delete the integration if test failed
        await supabase.from('integrations').delete().eq('id', data.id);
        throw new Error(testResult.data?.error || 'Connection test failed');
      }
      
      // Auto-fetch lists after successful connection
      try {
        await supabase.functions.invoke('planning-center-lists', {
          body: {
            action: 'fetchLists',
            integrationId: data.id
          }
        });
      } catch (listError) {
        console.warn('Failed to pre-fetch lists:', listError);
        // Don't fail the integration creation for this
      }
      
      return { ...data, connectionTest: testResult.data };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['integrations']
      });
      setPlanningCenterForm({
        appId: '',
        secret: ''
      });
      toast({
        title: 'Integration Connected',
        description: `Successfully connected to Planning Center as ${data.connectionTest?.user?.first_name} ${data.connectionTest?.user?.last_name}. Lists have been pre-loaded for quick mapping.`
      });
    },
    onError: error => {
      toast({
        title: 'Connection Failed',
        description: `Failed to connect to Planning Center: ${error.message}`,
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
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Connected & Syncing</Badge>;
    }
    if (integration?.status === 'connecting') {
      return <Badge variant="secondary">Testing Connection...</Badge>;
    }
    if (integration?.status === 'failed') {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Connection Failed</Badge>;
    }
    if (integration) {
      return <Badge variant="secondary">Not Tested</Badge>;
    }
    return <Badge variant="outline">Not Connected</Badge>;
  };
  return <div className="flex flex-col h-full">
      <Header 
        title="Integrations" 
        description="Connect and manage your external tools and services"
        showFlowIcon={false}
        showAddButton={false}
      />

      <div className="flex-1 overflow-auto p-6 max-w-6xl mx-auto space-y-6 pb-12">
        {/* Planning Center Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Database className="h-5 w-5 text-sidebar-foreground" />
                </div>
                <div>
                  <CardTitle>Planning Center</CardTitle>
                  <CardDescription>Assign people to the right Flow</CardDescription>
                </div>
              </div>
              {getStatusBadge(planningCenterIntegration, integrationsLoading)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Automatically sync your Planning Center people into the right Flows — mapping lists to spiritual steps that drive real connection, discipleship, and next steps.</p>
            
            {!planningCenterIntegration && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Quick Setup Guide
                </h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Get your API credentials from Planning Center</li>
                  <li>Enter them below and we'll automatically test the connection</li>
                  <li>Your lists will be pre-loaded for instant mapping</li>
                  <li>Auto-sync is enabled by default every 15 minutes</li>
                </ol>
              </div>
            )}
            
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
                 </div>
                
                <Separator />
                
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
              We believe ministry should be seamless. That's why Flowleed will soon connect with tools like Rock RMS, Overflow, Tithe.ly, Pushpay, and more — building spiritual momentum that starts with your people.
            </p>
          </CardContent>
        </Card>
      </div>

      <QuickMappingDialog isOpen={mappingDialogOpen} onOpenChange={setMappingDialogOpen} integrationId={selectedIntegrationId} />
    </div>;
};
export default IntegrationsPage;
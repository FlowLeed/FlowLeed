import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { ExternalLink, Loader2, CheckCircle, AlertCircle, Key, Database, Calendar, Mail, Zap } from "lucide-react";
import { QuickMappingDialog } from "@/components/integrations/QuickMappingDialog";
import { ListMappingManager } from "@/components/integrations/ListMappingManager";
import { SyncSettingsSection } from "@/components/integrations/SyncSettingsSection";
import { useOrgOwnerOnboarding } from "@/hooks/useOrgOwnerOnboarding";
import { usePcoSyncJob } from "@/hooks/usePcoSyncJob";

const IntegrationsPage = () => {
  const queryClient = useQueryClient();
  const [planningCenterForm, setPlanningCenterForm] = useState({
    appId: '',
    secret: ''
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [currentSyncJobId, setCurrentSyncJobId] = useState<string | null>(null);
  const [showQuickMapping, setShowQuickMapping] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('');
  
  const { data: syncJob } = usePcoSyncJob(currentSyncJobId);
  const isSyncing = syncJob?.status === 'processing' || syncJob?.status === 'pending';

  // Get organization ID for onboarding
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
  
  const { updateProgress } = useOrgOwnerOnboarding(userOrgData?.organization_id);

  // Fetch existing integrations
  const {
    data: integrations,
    isLoading: integrationsLoading
  } = useQuery({
    queryKey: ['integrations', userOrgData?.organization_id],
    enabled: !!userOrgData?.organization_id,
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase
        .from('integrations')
        .select('*')
        .eq('service_name', 'planning_center')
        .eq('organization_id', userOrgData!.organization_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
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
        data: orgMember,
        error: orgError
      } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).single();
      
      if (orgError || !orgMember?.organization_id) {
        throw new Error('No organization found for your account. Please join or create an organization first.');
      }

      // Check for existing integration to prevent duplicates
      const { data: existing } = await supabase
        .from('integrations')
        .select('id')
        .eq('service_name', 'planning_center')
        .eq('organization_id', orgMember.organization_id)
        .maybeSingle();

      if (existing?.id) {
        throw new Error('Planning Center is already connected for this organization.');
      }
      
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
        organization_id: orgMember.organization_id,
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
    onSuccess: async (data) => {
      queryClient.invalidateQueries({
        queryKey: ['integrations', userOrgData?.organization_id]
      });
      setPlanningCenterForm({
        appId: '',
        secret: ''
      });
      toast.success('Integration Connected', {
        description: `Successfully connected to Planning Center as ${data.connectionTest?.user?.first_name} ${data.connectionTest?.user?.last_name}. Lists have been pre-loaded for quick mapping.`
      });
      
      // Update onboarding progress for pco_connected
      if (userOrgData?.organization_id) {
        await updateProgress('pco_connected', true);
      }
    },
    onError: error => {
      toast.error('Connection Failed', {
        description: `Failed to connect to Planning Center: ${error.message}`
      });
    }
  });
  const deleteIntegrationMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', integrationId);
      if (error) throw error;
    },
    onError: (error: Error) => {
      toast.error('Failed to disconnect', {
        description: error.message
      });
    },
    onSuccess: () => {
      // Clear form state for fresh reconnection
      setPlanningCenterForm({
        appId: '',
        secret: ''
      });
      setCurrentSyncJobId(null);
      
      toast.success('Integration Disconnected', {
        description: 'Successfully disconnected from Planning Center'
      });
    },
    onSettled: () => {
      // Refetch to update UI naturally
      queryClient.invalidateQueries({ 
        queryKey: ['integrations', userOrgData?.organization_id],
        refetchType: 'active'
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
          queryKey: ['integrations', userOrgData?.organization_id]
        });
        toast.success('Connection Successful', {
          description: `Connected as ${data.user?.first_name} ${data.user?.last_name}`
        });
      } else {
        throw new Error(data.error);
      }
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({
        queryKey: ['integrations', userOrgData?.organization_id]
      });
      toast.error('Connection Failed', {
        description: error.message || 'Failed to connect to Planning Center. Please check your credentials.'
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
    
    try {
      const { data, error } = await supabase.functions.invoke('planning-center-lists', {
        body: { 
          action: 'syncLists',
          integrationId: planningCenterIntegration.id 
        }
      });

      if (error) throw error;
      
      // Set the job ID to start polling
      if (data?.results?.[0]?.jobId) {
        setCurrentSyncJobId(data.results[0].jobId);
        toast.success("Sync started", {
          description: `Queued ${data.results[0].contactsCount || 0} contacts for processing`
        });
      } else {
        toast.success("Sync completed", {
          description: `Synced ${data?.results?.length || 0} list(s)`
        });
      }
      
      await queryClient.invalidateQueries({ queryKey: ['integrations', userOrgData?.organization_id] });
      window.dispatchEvent(new CustomEvent('pco-sync-complete'));
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error("Sync failed", {
        description: error.message || 'Failed to sync data from Planning Center'
      });
    }
  };
  const getStatusBadge = (integration: any, isLoading: boolean = false, isDeleting: boolean = false) => {
    if (isDeleting) {
      return <Badge variant="secondary">Disconnecting...</Badge>;
    }
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
              {getStatusBadge(planningCenterIntegration, integrationsLoading, deleteIntegrationMutation.isPending)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Automatically sync your Planning Center people into the right Flows — mapping lists to spiritual steps that drive real connection, discipleship, and next steps.</p>
            
            {!planningCenterIntegration && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Quick Setup Guide
                </h4>
                <div className="text-sm text-muted-foreground space-y-3">
                  <div>
                    <p className="font-medium text-foreground mb-1">1. Log in to Planning Center</p>
                    <p>Go to planningcenteronline.com and sign in to your account.</p>
                  </div>
                  
                  <div>
                    <p className="font-medium text-foreground mb-1">2. Open API Settings</p>
                    <p className="mb-2">Visit <a href="https://api.planningcenteronline.com/personal_access_tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://api.planningcenteronline.com/personal_access_tokens</a></p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>Create a New Personal Access Token</li>
                      <li>Click "New Personal Access Token"</li>
                      <li>Give it a clear name, like "FlowLeed Integration"</li>
                    </ul>
                    <p className="mt-2">The system will generate your Client ID and Secret</p>
                  </div>
                  
                  <div>
                    <p className="font-medium text-foreground mb-1">3. Enter Your Credentials Below</p>
                    <p>We'll automatically test your connection to make sure everything works.</p>
                  </div>
                  
                  <div>
                    <p className="font-medium text-foreground mb-1">4. Pre-Load Your Lists</p>
                    <p>Your lists will be instantly available for mapping.</p>
                  </div>
                  
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2 mt-2">
                    <p className="text-xs"><span className="font-semibold text-foreground">Important:</span> Copy both your Client ID and Secret right away. The secret is only shown once and cannot be retrieved later.</p>
                  </div>
                </div>
              </div>
            )}
            
            {!planningCenterIntegration ? <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="pc-app-id">Client ID</Label>
                  <Input id="pc-app-id" placeholder="Enter your Planning Center Client ID" value={planningCenterForm.appId} onChange={e => setPlanningCenterForm(prev => ({
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
                    <a href="https://api.planningcenteronline.com/personal_access_tokens" target="_blank" rel="noopener noreferrer">
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
                      {syncJob && syncJob.status !== 'completed' && syncJob.status !== 'failed' ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Syncing {syncJob.metadata?.list_name || 'contacts'}...
                            </span>
                            <span className="font-medium">
                              {syncJob.processed_contacts}/{syncJob.total_contacts}
                            </span>
                          </div>
                          <Progress 
                            value={(syncJob.processed_contacts / syncJob.total_contacts) * 100} 
                          />
                          <p className="text-xs text-muted-foreground text-center">
                            {Math.round((syncJob.processed_contacts / syncJob.total_contacts) * 100)}% complete
                          </p>
                        </div>
                      ) : (
                        <Button
                          onClick={handleSyncNow}
                          disabled={isSyncing}
                          className="w-full"
                        >
                          {isSyncing ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Syncing...
                            </>
                          ) : (
                            'Sync Now'
                          )}
                        </Button>
                      )}
                      
                      <Separator />
                      
                      <SyncSettingsSection
                        integrationId={planningCenterIntegration.id}
                        currentFrequency={planningCenterIntegration.sync_frequency || 'every_15_minutes'}
                        lastSyncAt={planningCenterIntegration.last_sync_at}
                        onSyncNow={handleSyncNow}
                        isSyncing={isSyncing}
                      />
                      
                      <Separator />
                      
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

      <QuickMappingDialog 
        isOpen={mappingDialogOpen} 
        onOpenChange={setMappingDialogOpen} 
        integrationId={selectedIntegrationId}
        onMappingCreated={async () => {
          // Update onboarding progress when mapping is created
          await updateProgress('pco_lists_mapped', true);
        }}
      />
    </div>;
};
export default IntegrationsPage;
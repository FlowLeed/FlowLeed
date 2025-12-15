import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { ExternalLink, Loader2, CheckCircle, AlertCircle, Key, Database, Calendar, Mail, Zap, Settings } from "lucide-react";
import { QuickMappingDialog } from "@/components/integrations/QuickMappingDialog";
import { ListMappingManager } from "@/components/integrations/ListMappingManager";
import { SyncSettingsSection } from "@/components/integrations/SyncSettingsSection";
import { SyncProgressDisplay } from "@/components/integrations/SyncProgressDisplay";
import { useOrgOwnerOnboarding } from "@/hooks/useOrgOwnerOnboarding";
import { usePcoSyncJob } from "@/hooks/usePcoSyncJob";

const IntegrationsPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [planningCenterForm, setPlanningCenterForm] = useState({
    appId: '',
    secret: ''
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [currentSyncJobId, setCurrentSyncJobId] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [showQuickMapping, setShowQuickMapping] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('');
  
  const { data: syncJob } = usePcoSyncJob(currentSyncJobId);
  const isSyncing = isPreparing || syncJob?.status === 'processing' || syncJob?.status === 'pending';

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

  // Auto-detect active sync jobs on page load
  const { data: activeJob } = useQuery({
    queryKey: ['active-sync-job', userOrgData?.organization_id],
    enabled: !!userOrgData?.organization_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('pco_sync_jobs')
        .select('id, status')
        .eq('organization_id', userOrgData!.organization_id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: (query) => {
      // Only refetch if there's an active job
      return query.state.data ? 3000 : false;
    }
  });

  // Set currentSyncJobId when an active job is found on load
  useEffect(() => {
    if (activeJob?.id && !currentSyncJobId && !isPreparing) {
      setCurrentSyncJobId(activeJob.id);
    }
  }, [activeJob?.id, currentSyncJobId, isPreparing]);

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
    if (!planningCenterIntegration || !userOrgData?.organization_id) return;
    
    // Check for existing active job to prevent duplicates
    const { data: existingJob } = await supabase
      .from('pco_sync_jobs')
      .select('id, status')
      .eq('organization_id', userOrgData.organization_id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingJob) {
      setCurrentSyncJobId(existingJob.id);
      toast.info("Sync already in progress", {
        description: "Showing the current sync progress"
      });
      return;
    }

    // Set preparing state immediately
    setIsPreparing(true);
    
    // First, test the connection before attempting sync
    try {
      const { data: testData, error: testError } = await supabase.functions.invoke('planning-center-lists', {
        body: {
          action: 'testConnection',
          integrationId: planningCenterIntegration.id
        }
      });

      if (testError || !testData?.success) {
        setIsPreparing(false);
        toast.error("Connection Failed", {
          description: testData?.error || 'Please check your Planning Center credentials and try reconnecting'
        });
        await queryClient.invalidateQueries({ queryKey: ['integrations', userOrgData?.organization_id] });
        return;
      }
    } catch (error: any) {
      setIsPreparing(false);
      console.error('Connection test error:', error);
      toast.error("Connection Failed", {
        description: 'Unable to connect to Planning Center. Please reconnect your account.'
      });
      return;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('planning-center-lists', {
        body: { 
          action: 'syncAllPeople',
          integrationId: planningCenterIntegration.id 
        }
      });

      setIsPreparing(false);

      if (error) throw error;
      
      // Handle 409 conflict (sync already in progress)
      if (data?.existingJobId) {
        setCurrentSyncJobId(data.existingJobId);
        toast.info("Sync already in progress", {
          description: "Showing the current sync progress"
        });
        return;
      }
      
      // Set the job ID to start polling
      if (data?.jobId) {
        setCurrentSyncJobId(data.jobId);
        toast.success("Sync started", {
          description: `Queued ${data.totalContacts || 0} people for processing`
        });
      } else {
        toast.success("Sync completed", {
          description: `Synced ${data?.totalContacts || 0} people`
        });
      }
      
      await queryClient.invalidateQueries({ queryKey: ['integrations', userOrgData?.organization_id] });
      window.dispatchEvent(new CustomEvent('pco-sync-complete'));
    } catch (error: any) {
      setIsPreparing(false);
      console.error('Sync error:', error);
      toast.error("Sync failed", {
        description: error.message || 'Failed to sync people from Planning Center'
      });
    }
  };

  const handleCancelSync = async () => {
    if (!currentSyncJobId) return;
    
    try {
      // Update job status to cancelled
      await supabase
        .from('pco_sync_jobs')
        .update({ status: 'cancelled' })
        .eq('id', currentSyncJobId);
      
      // Also cancel all pending queue items for this job
      await supabase
        .from('pco_sync_queue')
        .update({ status: 'cancelled' })
        .eq('sync_job_id', currentSyncJobId)
        .eq('status', 'pending');
      
      toast.success("Sync cancelled", {
        description: "The sync has been stopped. Already processed contacts will remain."
      });
      
      await queryClient.invalidateQueries({ queryKey: ['pco-sync-job', currentSyncJobId] });
    } catch (error: any) {
      console.error('Cancel sync error:', error);
      toast.error("Failed to cancel", {
        description: error.message || 'Could not cancel the sync'
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
            
            {/* Show error alert if integration failed */}
            {planningCenterIntegration?.status === 'failed' && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-destructive mb-1">Connection Failed</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      {(planningCenterIntegration.metadata as { error?: string })?.error || 'Unable to authenticate with Planning Center. Your credentials may be invalid or expired.'}
                    </p>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handlePlanningCenterDisconnect}
                      disabled={deleteIntegrationMutation.isPending}
                    >
                      Reconnect Planning Center
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
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
                   <Button 
                     variant="outline" 
                     onClick={() => navigate('/integrations/planning-center/advanced')}
                   >
                     <Settings className="h-4 w-4 mr-2" />
                     Advanced Settings
                   </Button>
                 </div>
                
                <Separator />
                
                 {planningCenterIntegration?.status === 'active' && <>
                    <Separator />
                    
                    <div className="space-y-6">
                      {(isPreparing || syncJob) && (
                        <SyncProgressDisplay
                          jobId={syncJob?.id}
                          jobStatus={syncJob?.status}
                          totalContacts={syncJob?.total_contacts}
                          processedContacts={syncJob?.processed_contacts}
                          listMappingId={syncJob?.list_mapping_id}
                          pipelineId={syncJob?.metadata?.pipeline_id}
                          stageId={syncJob?.metadata?.stage_id}
                          isFullPeopleSync={syncJob ? !syncJob.list_mapping_id : true}
                          isPreparing={isPreparing}
                          integrationId={planningCenterIntegration.id}
                          organizationId={userOrgData?.organization_id}
                          onCancel={isSyncing && !isPreparing ? handleCancelSync : undefined}
                        />
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
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
import { ExternalLink, Loader2, CheckCircle, AlertCircle, Database, Calendar, Mail, Zap, Settings } from "lucide-react";
import { QuickMappingDialog } from "@/components/integrations/QuickMappingDialog";
import { ListMappingManager } from "@/components/integrations/ListMappingManager";
import { SyncSettingsSection } from "@/components/integrations/SyncSettingsSection";
import { SyncProgressDisplay } from "@/components/integrations/SyncProgressDisplay";
import { ChurchOnlineIntegration } from "@/components/integrations/ChurchOnlineIntegration";
import { PcoEnforcementToggle } from "@/components/integrations/PcoEnforcementToggle";
import { useOrgOwnerOnboarding } from "@/hooks/useOrgOwnerOnboarding";
import { usePcoSyncJob } from "@/hooks/usePcoSyncJob";

const IntegrationsPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Planning Center now uses OAuth only — no PAT form state.

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

  // Auto-detect active "Sync All People" jobs on page load (list_mapping_id IS NULL)
  const { data: activeJob } = useQuery({
    queryKey: ['active-sync-job', userOrgData?.organization_id],
    enabled: !!userOrgData?.organization_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('pco_sync_jobs')
        .select('id, status')
        .eq('organization_id', userOrgData!.organization_id)
        .is('list_mapping_id', null) // Only "Sync All People" jobs
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
        .select('id, organization_id, user_id, service_name, status, metadata, sync_frequency, last_sync_at, auto_sync_all_people, provider_account_name, oauth_scopes, auth_type, settings, created_at, updated_at')
        .eq('service_name', 'planning_center')
        .eq('organization_id', userOrgData!.organization_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
  });
  const planningCenterIntegration = integrations?.[0];
  // Legacy PAT-based createIntegrationMutation removed — OAuth is the only connect path.

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
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleConnectPcoOAuth = async () => {
    if (!userOrgData?.organization_id) {
      toast.error('No organization');
      return;
    }
    setOauthLoading(true);
    // Use the top-level window's origin when we're inside the Lovable preview iframe,
    // so the OAuth redirect_uri matches what's registered in PCO and the callback page loads.
    let topOrigin = window.location.origin;
    try {
      if (window.top && window.top.location && window.top.location.origin) {
        topOrigin = window.top.location.origin;
      }
    } catch {
      // Cross-origin top — fall back to current origin.
    }
    try {
      const { data, error } = await supabase.functions.invoke('pco-oauth-start', {
        body: {
          organizationId: userOrgData.organization_id,
          purpose: 'org',
          redirectOrigin: topOrigin,
        },
      });
      if (error || !data?.authorizeUrl) {
        throw new Error(data?.error || error?.message || 'Failed to start OAuth');
      }
      // Redirect the top-level window (breaks out of the Lovable preview iframe).
      try {
        if (window.top) {
          window.top.location.href = data.authorizeUrl;
        } else {
          window.location.href = data.authorizeUrl;
        }
      } catch {
        window.location.href = data.authorizeUrl;
      }
    } catch (e: any) {
      toast.error(e.message);
      setOauthLoading(false);
    }
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
    
    // Set preparing state immediately
    setIsPreparing(true);
    
    // Cancel any existing "Sync All People" jobs before starting a new one
    const { data: existingJobs } = await supabase
      .from('pco_sync_jobs')
      .select('id')
      .eq('organization_id', userOrgData.organization_id)
      .is('list_mapping_id', null) // Only "Sync All People" jobs
      .in('status', ['pending', 'processing']);

    if (existingJobs && existingJobs.length > 0) {
      const jobIds = existingJobs.map(j => j.id);
      
      // Cancel the jobs
      await supabase
        .from('pco_sync_jobs')
        .update({ status: 'cancelled' })
        .in('id', jobIds);
      
      // Cancel any pending queue items for these jobs
      await supabase
        .from('pco_sync_queue')
        .update({ status: 'cancelled' })
        .in('sync_job_id', jobIds)
        .eq('status', 'pending');
      
      console.log('Cancelled existing sync jobs:', jobIds);
    }
    
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
      } else if (data?.totalContacts === 0) {
        toast.success("Everything is up to date", {
          description: "No new or updated people found since the last sync"
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

            {/* Reauth required: OAuth refresh failed (e.g., admin revoked install) */}
            {planningCenterIntegration?.status === 'reauth_required' && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-1">
                      Reconnect Planning Center
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Your Planning Center session expired or was revoked. Reconnect to resume syncing.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleConnectPcoOAuth}
                      disabled={oauthLoading || !userOrgData?.organization_id}
                    >
                      Reconnect Planning Center
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Legacy PAT → OAuth migration prompt */}
            {planningCenterIntegration?.auth_type === 'pat' && planningCenterIntegration?.status !== 'reauth_required' && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-1">
                      Upgrade to OAuth connection
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      You're connected with a legacy Personal Access Token. Switching to OAuth removes the need to manage tokens manually, refreshes automatically, and unlocks per-user permission enforcement. Your sync settings and mappings are preserved.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleConnectPcoOAuth}
                      disabled={oauthLoading || !userOrgData?.organization_id}
                    >
                      {oauthLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Switch to OAuth
                    </Button>
                  </div>
                </div>
              </div>
            )}


            {/* OAuth: connected account label */}
            {planningCenterIntegration?.auth_type === 'oauth' && planningCenterIntegration?.provider_account_name && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-sm">
                <span className="text-muted-foreground">Connected to:</span>{' '}
                <span className="font-medium text-foreground">{planningCenterIntegration.provider_account_name}</span>
                {planningCenterIntegration.oauth_scopes && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({planningCenterIntegration.oauth_scopes})
                  </span>
                )}
              </div>
            )}

            {planningCenterIntegration?.auth_type === 'oauth' && (
              <PcoEnforcementToggle organizationId={userOrgData?.organization_id} />
            )}

            {/* OAuth: primary connect CTA when nothing is connected */}
            {!planningCenterIntegration && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                <div>
                  <h4 className="font-semibold text-sm">Connect with OAuth (recommended)</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sign in with your Planning Center account — no manual tokens, automatic refresh, and stays connected to a specific PCO organization.
                  </p>
                </div>
                <Button onClick={handleConnectPcoOAuth} disabled={oauthLoading || !userOrgData?.organization_id}>
                  {oauthLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Connect Planning Center
                </Button>
              </div>
            )}

            {planningCenterIntegration && <div className="space-y-4">

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
                      <SyncSettingsSection
                        integrationId={planningCenterIntegration.id}
                        currentFrequency={planningCenterIntegration.sync_frequency || 'daily'}
                        lastSyncAt={planningCenterIntegration.last_sync_at}
                        autoSyncAllEnabled={planningCenterIntegration.auto_sync_all_people ?? true}
                        onSyncNow={handleSyncNow}
                        isSyncing={isSyncing}
                      />
                      
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
                      
                      <ListMappingManager integrationId={planningCenterIntegration.id} onCreateMapping={() => {
                  setSelectedIntegrationId(planningCenterIntegration.id);
                  setMappingDialogOpen(true);
                }} />
                    </div>
                  </>}
              </div>}
          </CardContent>
        </Card>

        {/* Church Online Platform Integration */}
        {userOrgData?.organization_id && (
          <ChurchOnlineIntegration organizationId={userOrgData.organization_id} />
        )}

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
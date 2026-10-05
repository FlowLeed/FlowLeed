import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, StopCircle, Check, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useFlowContext } from "@/contexts/FlowContext";

interface SyncProgressDisplayProps {
  jobId?: string | null;
  jobStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalContacts?: number;
  processedContacts?: number;
  listMappingId?: string | null;
  pipelineId?: string | null;
  stageId?: string | null;
  isFullPeopleSync?: boolean;
  isPreparing?: boolean;
  integrationId?: string;
  organizationId?: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function SyncProgressDisplay({
  jobId,
  jobStatus,
  totalContacts = 0,
  processedContacts = 0,
  listMappingId,
  pipelineId,
  stageId,
  isFullPeopleSync = false,
  isPreparing = false,
  integrationId,
  organizationId,
  onComplete,
  onCancel,
}: SyncProgressDisplayProps) {
  const { toast } = useToast();
  const { refreshFlows } = useFlowContext();
  const [hasShownCompletion, setHasShownCompletion] = useState(false);
  const [momentsSyncStatus, setMomentsSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle');

  // Auto-trigger moments backfill after contact sync completes
  const backfillMoments = useMutation({
    mutationFn: async () => {
      if (!integrationId || !organizationId) return null;
      
      const { data, error } = await supabase.functions.invoke('pco-backfill-moments', {
        body: { integrationId, organizationId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        setMomentsSyncStatus('done');
        toast({
          title: "Moments Synced",
          description: `Created ${data.momentsCreated} flow moments for ${data.contactsProcessed} contacts`,
        });
      }
    },
    onError: (error: Error) => {
      setMomentsSyncStatus('idle');
      console.error('Moments backfill error:', error);
      // Don't show error toast - moments sync is secondary
    }
  });

  // Fetch chunk processing status
  const { data: queueStatus } = useQuery({
    queryKey: ['pco-sync-queue-status', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pco_sync_queue')
        .select('status')
        .eq('sync_job_id', jobId);

      if (error) throw error;

      const statusCounts = data.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const total = data.length;
      const completed = statusCounts.completed || 0;
      const processing = statusCounts.processing || 0;
      const pending = statusCounts.pending || 0;

      return { total, completed, processing, pending, statusCounts };
    },
    enabled: jobStatus === 'processing' || jobStatus === 'pending',
    refetchInterval: 2000,
  });

  // Fetch real-time contact count in pipeline (only for list-based syncs)
  const { data: contactsInFlow } = useQuery({
    queryKey: ['pipeline-contacts-count', pipelineId, stageId, jobId],
    queryFn: async () => {
      const { data: job } = await supabase
        .from('pco_sync_jobs')
        .select('started_at')
        .eq('id', jobId)
        .single();

      if (!job) return 0;

      const { count, error } = await supabase
        .from('pipeline_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('pipeline_id', pipelineId!)
        .eq('stage_id', stageId!)
        .gte('created_at', job.started_at);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!jobId && !!pipelineId && !!stageId && !isFullPeopleSync,
    refetchInterval: 2000,
  });

  // Show completion toast, refresh flows, and trigger moments sync
  useEffect(() => {
    const canShowCompletion = isFullPeopleSync 
      ? jobStatus === 'completed' && !hasShownCompletion
      : jobStatus === 'completed' && !hasShownCompletion && contactsInFlow !== undefined;
    
    if (canShowCompletion) {
      setHasShownCompletion(true);
      refreshFlows();
      
      if (isFullPeopleSync) {
        toast({
          title: "People Sync Complete!",
          description: `${processedContacts} people synced to Flowleed`,
        });
      } else {
        toast({
          title: "Contact Sync Complete!",
          description: `${contactsInFlow} contacts added to the flow`,
        });
      }
      
      // Auto-trigger moments backfill if we have the required IDs
      if (integrationId && organizationId && momentsSyncStatus === 'idle') {
        setMomentsSyncStatus('syncing');
        backfillMoments.mutate();
      }
      
      // Call completion callback if provided
      onComplete?.();
    }
  }, [jobStatus, contactsInFlow, hasShownCompletion, toast, refreshFlows, onComplete, integrationId, organizationId, momentsSyncStatus, isFullPeopleSync, processedContacts]);

  const progressPercentage = totalContacts > 0 
    ? Math.round((processedContacts / totalContacts) * 100) 
    : 0;

  // Initial preparing phase - user clicked button, waiting for job to be created
  if (isPreparing) {
    return (
      <div className="space-y-3 py-4">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground animate-pulse">
            Connecting to Planning Center...
          </span>
        </div>
        <div className="flex gap-1.5 justify-center">
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce"></span>
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.1s' }}></span>
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }}></span>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Fetching people from Planning Center. This may take a moment for large organizations...
        </p>
      </div>
    );
  }

  // No job to display
  if (!jobId || !jobStatus) {
    return null;
  }

  // Preparing phase - job created but not processed yet
  if (processedContacts === 0 && jobStatus !== 'completed') {
    return (
      <div className="space-y-3 py-4">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground animate-pulse">
            {isFullPeopleSync 
              ? `Preparing to sync ${totalContacts} people from Planning Center...`
              : `Preparing to sync ${totalContacts} contacts...`
            }
          </span>
        </div>
        <div className="flex gap-1.5 justify-center">
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce"></span>
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.1s' }}></span>
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }}></span>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          This may take a moment while we fetch {isFullPeopleSync ? 'people' : 'contacts'} from Planning Center...
        </p>
      </div>
    );
  }

  // Processing phase
  if (jobStatus === 'processing' || (processedContacts > 0 && jobStatus !== 'completed' && jobStatus !== 'cancelled')) {
    return (
      <div className="space-y-3 py-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-muted-foreground">
              {isFullPeopleSync ? 'Syncing people to Flowleed...' : 'Syncing contacts...'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-medium">
              {processedContacts}/{totalContacts}
            </span>
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <StopCircle className="h-4 w-4 mr-1" />
                Stop
              </Button>
            )}
          </div>
        </div>

        <Progress value={progressPercentage} className="h-2" />

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {progressPercentage}% complete
          </p>
          
          {queueStatus && queueStatus.total > 0 && (
            <p className="text-xs text-muted-foreground">
              {queueStatus.processing > 0 && (
                <span>Processing chunk {queueStatus.completed + 1} of {queueStatus.total}</span>
              )}
              {queueStatus.processing === 0 && queueStatus.pending > 0 && (
                <span>Waiting for next processing cycle...</span>
              )}
            </p>
          )}

          {!isFullPeopleSync && contactsInFlow !== undefined && contactsInFlow > 0 && (
            <p className="text-xs text-primary font-medium">
              ✓ {contactsInFlow} contacts added to flow
            </p>
          )}
        </div>
      </div>
    );
  }

  // Cancelled phase
  if (jobStatus === 'cancelled') {
    return (
      <div className="space-y-2 py-4">
        <div className="flex items-center justify-center gap-2 text-sm text-amber-600">
          <StopCircle className="h-5 w-5" />
          <span className="font-medium">Sync cancelled</span>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Processed {processedContacts} of {totalContacts} contacts before stopping.
        </p>
      </div>
    );
  }

  // Completed phase
  if (jobStatus === 'completed') {
    return (
      <div className="space-y-3 py-4">
        <div className="flex items-center justify-center gap-2 text-sm text-primary">
          <Check className="h-5 w-5" />
          <span className="font-medium">Sync completed successfully!</span>
        </div>
        
        <div className="space-y-1 text-center">
          <p className="text-sm text-muted-foreground">
            {isFullPeopleSync 
              ? `${processedContacts} people synced to Flowleed`
              : `Processed: ${processedContacts}/${totalContacts} contacts`
            }
          </p>
          {!isFullPeopleSync && contactsInFlow !== undefined && (
            <p className="text-sm font-medium text-primary">
              {contactsInFlow} contacts added to flow
              {contactsInFlow < processedContacts && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({processedContacts - contactsInFlow} already existed)
                </span>
              )}
            </p>
          )}
          
          {/* Moments sync status */}
          {momentsSyncStatus === 'syncing' && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Syncing flow moments...</span>
            </div>
          )}
          {momentsSyncStatus === 'done' && (
            <p className="text-xs text-muted-foreground mt-2">
              ✓ Flow moments synced
            </p>
          )}
        </div>
      </div>
    );
  }

  // Failed phase
  if (jobStatus === 'failed') {
    return (
      <div className="space-y-2 py-4">
        <div className="flex items-center justify-center gap-2 text-sm text-destructive">
          <X className="h-5 w-5" />
          <span className="font-medium">Sync failed</span>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Please try again or contact support if the issue persists.
        </p>
      </div>
    );
  }

  return null;
}

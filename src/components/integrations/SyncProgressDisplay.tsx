import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

interface SyncProgressDisplayProps {
  jobId: string;
  jobStatus: 'pending' | 'processing' | 'completed' | 'failed';
  totalContacts: number;
  processedContacts: number;
  listMappingId: string;
  pipelineId: string;
  stageId: string;
}

export function SyncProgressDisplay({
  jobId,
  jobStatus,
  totalContacts,
  processedContacts,
  listMappingId,
  pipelineId,
  stageId,
}: SyncProgressDisplayProps) {
  const { toast } = useToast();
  const [hasShownCompletion, setHasShownCompletion] = useState(false);

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

  // Fetch real-time contact count in pipeline
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
        .eq('pipeline_id', pipelineId)
        .eq('stage_id', stageId)
        .gte('created_at', job.started_at);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!jobId && !!pipelineId && !!stageId,
    refetchInterval: 2000,
  });

  // Show completion toast
  useEffect(() => {
    if (jobStatus === 'completed' && !hasShownCompletion && contactsInFlow !== undefined) {
      setHasShownCompletion(true);
      toast({
        title: "Sync Complete!",
        description: `${contactsInFlow} contacts added to the flow`,
      });
    }
  }, [jobStatus, contactsInFlow, hasShownCompletion, toast]);

  const progressPercentage = totalContacts > 0 
    ? Math.round((processedContacts / totalContacts) * 100) 
    : 0;

  // Preparing phase - when job just started
  if (processedContacts === 0 && jobStatus !== 'completed') {
    return (
      <div className="space-y-3 py-4">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground animate-pulse">
            Preparing to sync {totalContacts} contacts...
          </span>
        </div>
        <div className="flex gap-1.5 justify-center">
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce"></span>
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.1s' }}></span>
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }}></span>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          This may take a moment while we fetch contacts from Planning Center...
        </p>
      </div>
    );
  }

  // Processing phase
  if (jobStatus === 'processing' || (processedContacts > 0 && jobStatus !== 'completed')) {
    return (
      <div className="space-y-3 py-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-muted-foreground">
              Syncing contacts...
            </span>
          </div>
          <span className="font-medium">
            {processedContacts}/{totalContacts}
          </span>
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

          {contactsInFlow !== undefined && contactsInFlow > 0 && (
            <p className="text-xs text-primary font-medium">
              ✓ {contactsInFlow} contacts added to flow
            </p>
          )}
        </div>
      </div>
    );
  }

  // Completed phase
  if (jobStatus === 'completed') {
    return (
      <div className="space-y-3 py-4">
        <div className="flex items-center justify-center gap-2 text-sm text-primary">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">Sync completed successfully!</span>
        </div>
        
        <div className="space-y-1 text-center">
          <p className="text-sm text-muted-foreground">
            Processed: {processedContacts}/{totalContacts} contacts
          </p>
          {contactsInFlow !== undefined && (
            <p className="text-sm font-medium text-primary">
              {contactsInFlow} contacts added to flow
              {contactsInFlow < processedContacts && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({processedContacts - contactsInFlow} already existed)
                </span>
              )}
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
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
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

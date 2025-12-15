import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PcoSyncJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  total_contacts: number;
  processed_contacts: number;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
  metadata: any;
  list_mapping_id: string | null;
}

export function usePcoSyncJob(jobId: string | null) {
  return useQuery({
    queryKey: ['pco-sync-job', jobId],
    queryFn: async () => {
      if (!jobId) return null;

      const { data, error } = await supabase
        .from('pco_sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return data as any as PcoSyncJob;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      // Stop polling if job is completed, failed, or cancelled
      const data = query.state.data;
      if (data?.status === 'completed' || data?.status === 'failed' || data?.status === 'cancelled') {
        return false;
      }
      // Poll every 2 seconds while processing
      return 2000;
    },
  });
}

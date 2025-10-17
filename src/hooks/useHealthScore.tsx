import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface HealthScoreData {
  total_score: number;
  breakdown: {
    user_activity: { score: number; max: number };
    flows_usage: { score: number; max: number };
    followups: { score: number; max: number };
    pco_sync: { score: number; max: number };
    ai_usage: { score: number; max: number };
    engagement_growth: { score: number; max: number };
    setup: { score: number; max: number };
  };
  metrics: {
    avg_logins_per_user_per_week: number;
    people_moved_per_week: number;
    active_flows_count: number;
    completion_rate: number;
    interactions_per_week: number;
    last_pco_sync_days: number;
    ai_uses_30d: number;
    contact_growth_percent: number;
    total_users: number;
    contacts_now: number;
  };
  setup_checklist: {
    profile_completed: boolean;
    team_invited: boolean;
    first_flow_created: boolean;
    pco_connected: boolean;
    first_contact_added: boolean;
  };
}

export const useHealthScore = (organizationId: string | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['health-score', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      
      const { data, error } = await supabase
        .rpc('calculate_health_score_v2', { org_id: organizationId });

      if (error) throw error;
      return data as unknown as HealthScoreData;
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const recalculateMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const { data, error } = await supabase
        .rpc('calculate_health_score_v2', { org_id: orgId });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-score', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      toast({
        title: "Success",
        description: "Health score recalculated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to recalculate health score",
        variant: "destructive",
      });
      console.error("Health score calculation error:", error);
    },
  });

  return {
    data,
    isLoading,
    error,
    recalculate: (orgId: string) => recalculateMutation.mutate(orgId),
    isRecalculating: recalculateMutation.isPending,
  };
};

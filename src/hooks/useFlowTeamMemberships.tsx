import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a Map<userId, Set<pipelineId>> describing which flows each user
 * is a team member of. Admin-only (gated by `enabled`).
 */
export const useFlowTeamMemberships = (enabled: boolean) => {
  return useQuery({
    queryKey: ["flow-team-memberships-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_team_members")
        .select("user_id, pipeline_id");
      if (error) throw error;

      const map = new Map<string, Set<string>>();
      (data || []).forEach((row: any) => {
        if (!row.user_id || !row.pipeline_id) return;
        if (!map.has(row.user_id)) map.set(row.user_id, new Set());
        map.get(row.user_id)!.add(row.pipeline_id);
      });
      return map;
    },
    enabled,
    staleTime: 60 * 1000,
  });
};

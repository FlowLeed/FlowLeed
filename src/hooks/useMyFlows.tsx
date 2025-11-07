import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// PHASE 5: Optimized to use single parallel query
export const useMyFlows = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["my-flows", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");

      // Fetch team memberships and assignments in parallel
      const [teamMembershipsResult, myAssignmentsResult] = await Promise.all([
        supabase
          .from("pipeline_team_members")
          .select("pipeline_id, role, pipelines(id, name, description, icon, flow_type, cycle_days)")
          .eq("user_id", userId),
        supabase
          .from("pipeline_contacts")
          .select("pipeline_id")
          .eq("assigned_to_user_id", userId)
      ]);

      if (!teamMembershipsResult.data || teamMembershipsResult.data.length === 0) {
        return [];
      }

      // Count assignments per pipeline
      const assignmentCounts = new Map();
      myAssignmentsResult.data?.forEach((a) => {
        assignmentCounts.set(
          a.pipeline_id,
          (assignmentCounts.get(a.pipeline_id) || 0) + 1
        );
      });

      return teamMembershipsResult.data.map((tm) => ({
        ...tm.pipelines,
        role: tm.role,
        myContactsCount: assignmentCounts.get(tm.pipeline_id) || 0,
        flow_type: (tm.pipelines?.flow_type || 'linear') as 'linear' | 'recurring',
        cycle_days: tm.pipelines?.cycle_days ?? undefined,
      }));
    },
    enabled: !!userId,
  });
};

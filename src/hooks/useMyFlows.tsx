import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useMyFlows = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["my-flows", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");

      // Get flows where I'm a team member
      const { data: teamMemberships } = await supabase
        .from("pipeline_team_members")
        .select("pipeline_id, role, pipelines(id, name, description, icon)")
        .eq("user_id", userId);

      if (!teamMemberships || teamMemberships.length === 0) {
        return [];
      }

      const pipelineIds = teamMemberships.map((tm) => tm.pipeline_id);

      // Get count of contacts assigned to me in each flow
      const { data: myAssignments } = await supabase
        .from("pipeline_contacts")
        .select("pipeline_id")
        .in("pipeline_id", pipelineIds)
        .eq("assigned_to_user_id", userId);

      const assignmentCounts = new Map();
      myAssignments?.forEach((a) => {
        assignmentCounts.set(
          a.pipeline_id,
          (assignmentCounts.get(a.pipeline_id) || 0) + 1
        );
      });

      return teamMemberships.map((tm) => ({
        ...tm.pipelines,
        role: tm.role,
        myContactsCount: assignmentCounts.get(tm.pipeline_id) || 0,
      }));
    },
    enabled: !!userId,
  });
};

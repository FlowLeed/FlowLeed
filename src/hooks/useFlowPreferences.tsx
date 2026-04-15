import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useFlowPreferences = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: pinnedFlowIds = new Set<string>(), isLoading } = useQuery({
    queryKey: ["flow-preferences", userId],
    queryFn: async () => {
      if (!userId) return new Set<string>();
      const { data, error } = await supabase
        .from("user_flow_preferences")
        .select("pipeline_id")
        .eq("user_id", userId)
        .eq("is_pinned", true);
      if (error) throw error;
      return new Set<string>(data?.map((d) => d.pipeline_id) || []);
    },
    enabled: !!userId,
  });

  const togglePin = useMutation({
    mutationFn: async (pipelineId: string) => {
      if (!userId) throw new Error("Not authenticated");
      const isPinned = pinnedFlowIds.has(pipelineId);

      if (isPinned) {
        const { error } = await supabase
          .from("user_flow_preferences")
          .delete()
          .eq("user_id", userId)
          .eq("pipeline_id", pipelineId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_flow_preferences")
          .upsert(
            { user_id: userId, pipeline_id: pipelineId, is_pinned: true },
            { onConflict: "user_id,pipeline_id" }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-preferences", userId] });
    },
  });

  return { pinnedFlowIds, isLoading, togglePin: togglePin.mutate };
};

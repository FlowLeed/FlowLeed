import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FlowResource, Block } from "@/types/resources";
import { toast } from "sonner";

export const useFlowResources = (pipelineId: string | null) => {
  const queryClient = useQueryClient();

  const { data: resource, isLoading } = useQuery({
    queryKey: ["flow-resources", pipelineId],
    queryFn: async () => {
      if (!pipelineId) return null;

      const { data, error } = await supabase
        .from("pipeline_resources")
        .select("*")
        .eq("pipeline_id", pipelineId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      return {
        ...data,
        content: data.content as unknown as Block[],
      } as FlowResource;
    },
    enabled: !!pipelineId,
  });

  const createMutation = useMutation({
    mutationFn: async ({ 
      pipelineId, 
      organizationId, 
      content 
    }: { 
      pipelineId: string; 
      organizationId: string; 
      content: Block[] 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("pipeline_resources")
        .insert({
          pipeline_id: pipelineId,
          organization_id: organizationId,
          content: content as any,
          created_by_user_id: user?.id,
          last_edited_by_user_id: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-resources", pipelineId] });
    },
    onError: (error) => {
      console.error("Error creating resources:", error);
      toast.error("Failed to create resources");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ 
      resourceId, 
      content 
    }: { 
      resourceId: string; 
      content: Block[] 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("pipeline_resources")
        .update({
          content: content as any,
          last_edited_by_user_id: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", resourceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-resources", pipelineId] });
    },
    onError: (error) => {
      console.error("Error updating resources:", error);
      toast.error("Failed to save resources");
    },
  });

  return {
    resource,
    isLoading,
    createResource: createMutation.mutate,
    updateResource: updateMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
};

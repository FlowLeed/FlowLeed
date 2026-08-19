import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrgTags, invalidateTagKeys } from "@/hooks/useOrgTags";

export interface TagWithCount {
  tag: string;
  count: number;
}

export const useOrgTagManagement = (organizationId?: string) => {
  const queryClient = useQueryClient();
  const { tagStats, isLoading } = useOrgTags(organizationId);

  const onDone = (message: string) => {
    invalidateTagKeys(queryClient);
    toast.success(message);
  };

  // Rename a tag globally across all contacts in the organization
  const renameTagMutation = useMutation({
    mutationFn: async ({ oldTag, newTag }: { oldTag: string; newTag: string }) => {
      if (!organizationId) throw new Error("No organization selected");
      const { error } = await supabase.rpc("rename_org_tag", {
        p_org_id: organizationId,
        p_old_tag: oldTag,
        p_new_tag: newTag,
      });
      if (error) throw error;
    },
    onSuccess: () => onDone("Tag renamed successfully"),
    onError: (error) => {
      console.error("Error renaming tag:", error);
      toast.error("Failed to rename tag");
    },
  });

  // Delete a tag globally across all contacts in the organization
  const deleteTagMutation = useMutation({
    mutationFn: async (tag: string) => {
      if (!organizationId) throw new Error("No organization selected");
      const { error } = await supabase.rpc("delete_org_tag", {
        p_org_id: organizationId,
        p_tag: tag,
      });
      if (error) throw error;
    },
    onSuccess: () => onDone("Tag deleted successfully"),
    onError: (error) => {
      console.error("Error deleting tag:", error);
      toast.error("Failed to delete tag");
    },
  });

  // Merge multiple tags into one
  const mergeTagsMutation = useMutation({
    mutationFn: async ({ sourceTags, targetTag }: { sourceTags: string[]; targetTag: string }) => {
      if (!organizationId) throw new Error("No organization selected");
      const { error } = await supabase.rpc("merge_org_tags", {
        p_org_id: organizationId,
        p_source_tags: sourceTags,
        p_target_tag: targetTag,
      });
      if (error) throw error;
    },
    onSuccess: () => onDone("Tags merged successfully"),
    onError: (error) => {
      console.error("Error merging tags:", error);
      toast.error("Failed to merge tags");
    },
  });

  return {
    tagStats,
    isLoading,
    renameTag: renameTagMutation.mutate,
    deleteTag: deleteTagMutation.mutate,
    mergeTags: mergeTagsMutation.mutate,
    isRenaming: renameTagMutation.isPending,
    isDeleting: deleteTagMutation.isPending,
    isMerging: mergeTagsMutation.isPending,
  };
};

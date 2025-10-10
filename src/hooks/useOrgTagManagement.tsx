import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TagWithCount {
  tag: string;
  count: number;
}

export const useOrgTagManagement = (organizationId?: string) => {
  const queryClient = useQueryClient();

  // Fetch all unique tags with counts for the organization
  const { data: tagStats = [], isLoading } = useQuery({
    queryKey: ["org-tag-stats", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      // Get all contacts in the organization
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id")
        .eq("organization_id", organizationId);

      if (!contacts || contacts.length === 0) return [];

      const contactIds = contacts.map((c) => c.id);

      // Get all tags for these contacts
      const { data, error } = await supabase
        .from("contact_tags")
        .select("tag")
        .in("contact_id", contactIds);

      if (error) throw error;

      // Count occurrences of each tag
      const tagCounts = new Map<string, number>();
      data?.forEach((item) => {
        const count = tagCounts.get(item.tag) || 0;
        tagCounts.set(item.tag, count + 1);
      });

      // Convert to array and sort by count descending
      return Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
    },
    enabled: !!organizationId,
  });

  // Rename a tag globally across all contacts in the organization
  const renameTagMutation = useMutation({
    mutationFn: async ({ oldTag, newTag }: { oldTag: string; newTag: string }) => {
      if (!organizationId) throw new Error("No organization selected");

      // Get all contacts in the organization
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id")
        .eq("organization_id", organizationId);

      if (!contacts || contacts.length === 0) return;

      const contactIds = contacts.map((c) => c.id);

      // Update all tags
      const { error } = await supabase
        .from("contact_tags")
        .update({ tag: newTag })
        .eq("tag", oldTag)
        .in("contact_id", contactIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tag-stats", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["org-tag-suggestions", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["contact-tags"] });
      queryClient.invalidateQueries({ queryKey: ["contact-comprehensive"] });
      toast.success("Tag renamed successfully");
    },
    onError: (error) => {
      console.error("Error renaming tag:", error);
      toast.error("Failed to rename tag");
    },
  });

  // Delete a tag globally across all contacts in the organization
  const deleteTagMutation = useMutation({
    mutationFn: async (tag: string) => {
      if (!organizationId) throw new Error("No organization selected");

      // Get all contacts in the organization
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id")
        .eq("organization_id", organizationId);

      if (!contacts || contacts.length === 0) return;

      const contactIds = contacts.map((c) => c.id);

      // Delete all instances of this tag
      const { error } = await supabase
        .from("contact_tags")
        .delete()
        .eq("tag", tag)
        .in("contact_id", contactIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tag-stats", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["org-tag-suggestions", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["contact-tags"] });
      queryClient.invalidateQueries({ queryKey: ["contact-comprehensive"] });
      toast.success("Tag deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting tag:", error);
      toast.error("Failed to delete tag");
    },
  });

  // Merge multiple tags into one
  const mergeTagsMutation = useMutation({
    mutationFn: async ({ sourceTags, targetTag }: { sourceTags: string[]; targetTag: string }) => {
      if (!organizationId) throw new Error("No organization selected");

      // Get all contacts in the organization
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id")
        .eq("organization_id", organizationId);

      if (!contacts || contacts.length === 0) return;

      const contactIds = contacts.map((c) => c.id);

      // Update all source tags to the target tag
      const { error } = await supabase
        .from("contact_tags")
        .update({ tag: targetTag })
        .in("tag", sourceTags)
        .in("contact_id", contactIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tag-stats", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["org-tag-suggestions", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["contact-tags"] });
      queryClient.invalidateQueries({ queryKey: ["contact-comprehensive"] });
      toast.success("Tags merged successfully");
    },
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

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useOrgTags } from "@/hooks/useOrgTags";

export const useContactTags = (contactId: string) => {
  const queryClient = useQueryClient();

  // Fetch tags for a specific contact
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["contact-tags", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_tags")
        .select("tag")
        .eq("contact_id", contactId);

      if (error) throw error;
      return data?.map((t) => t.tag) || [];
    },
    enabled: !!contactId,
  });

  // Add a tag
  const addTagMutation = useMutation({
    mutationFn: async (tag: string) => {
      const { error } = await supabase
        .from("contact_tags")
        .insert({ contact_id: contactId, tag });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tags", contactId] });
      queryClient.invalidateQueries({ queryKey: ["contact-comprehensive", contactId] });
    },
    onError: (error) => {
      console.error("Error adding tag:", error);
      toast({ title: "Error adding tag", variant: "destructive" });
    },
  });

  // Remove a tag
  const removeTagMutation = useMutation({
    mutationFn: async (tag: string) => {
      const { error } = await supabase
        .from("contact_tags")
        .delete()
        .eq("contact_id", contactId)
        .eq("tag", tag);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tags", contactId] });
      queryClient.invalidateQueries({ queryKey: ["contact-comprehensive", contactId] });
    },
    onError: (error) => {
      console.error("Error removing tag:", error);
      toast({ title: "Error removing tag", variant: "destructive" });
    },
  });

  // Update all tags (replace)
  const updateTagsMutation = useMutation({
    mutationFn: async (newTags: string[]) => {
      // Delete all existing tags
      await supabase
        .from("contact_tags")
        .delete()
        .eq("contact_id", contactId);

      // Insert new tags
      if (newTags.length > 0) {
        const { error } = await supabase
          .from("contact_tags")
          .insert(newTags.map((tag) => ({ contact_id: contactId, tag })));

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tags", contactId] });
      queryClient.invalidateQueries({ queryKey: ["contact-comprehensive", contactId] });
      toast({ title: "Tags updated successfully" });
    },
    onError: (error) => {
      console.error("Error updating tags:", error);
      toast({ title: "Error updating tags", variant: "destructive" });
    },
  });

  return {
    tags,
    isLoading,
    addTag: addTagMutation.mutate,
    removeTag: removeTagMutation.mutate,
    updateTags: updateTagsMutation.mutate,
  };
};

/** Existing org tags, most used first — shared with Settings > Tag Management. */
export const useOrgTagSuggestions = (organizationId?: string) => {
  const { tags } = useOrgTags(organizationId);
  return { suggestions: tags };
};

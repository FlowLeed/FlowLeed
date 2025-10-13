import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const useBulkActions = (flowId: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const bulkChangeStage = async (contactIds: string[], newStageId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('pipeline_contacts')
        .update({ 
          stage_id: newStageId, 
          updated_at: new Date().toISOString() 
        })
        .in('contact_id', contactIds)
        .eq('pipeline_id', flowId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast.success(`${contactIds.length} contacts moved to new stage`);
      return true;
    } catch (error) {
      console.error("Error in bulk stage change:", error);
      toast.error("Failed to update stages");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const bulkReassign = async (contactIds: string[], userId: string | null) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('pipeline_contacts')
        .update({ 
          assigned_to_user_id: userId,
          updated_at: new Date().toISOString()
        })
        .in('contact_id', contactIds)
        .eq('pipeline_id', flowId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast.success(`${contactIds.length} contacts reassigned`);
      return true;
    } catch (error) {
      console.error("Error in bulk reassign:", error);
      toast.error("Failed to reassign contacts");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const bulkAddTags = async (contactIds: string[], tags: string[]) => {
    setIsLoading(true);
    try {
      // For each contact, get existing tags and merge
      for (const contactId of contactIds) {
        const { data: existingTags } = await supabase
          .from('contact_tags')
          .select('tag')
          .eq('contact_id', contactId);

        const existingTagSet = new Set(existingTags?.map(t => t.tag) || []);
        const newTags = tags.filter(tag => !existingTagSet.has(tag));

        if (newTags.length > 0) {
          const tagInserts = newTags.map(tag => ({
            contact_id: contactId,
            tag: tag
          }));

          await supabase
            .from('contact_tags')
            .insert(tagInserts);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast.success(`Tags added to ${contactIds.length} contacts`);
      return true;
    } catch (error) {
      console.error("Error in bulk add tags:", error);
      toast.error("Failed to add tags");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const bulkRemoveTags = async (contactIds: string[], tags: string[]) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .in('contact_id', contactIds)
        .in('tag', tags);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast.success(`Tags removed from ${contactIds.length} contacts`);
      return true;
    } catch (error) {
      console.error("Error in bulk remove tags:", error);
      toast.error("Failed to remove tags");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const bulkDelete = async (contactIds: string[]) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('pipeline_contacts')
        .delete()
        .in('contact_id', contactIds)
        .eq('pipeline_id', flowId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast.success(`${contactIds.length} contacts removed from flow`);
      return true;
    } catch (error) {
      console.error("Error in bulk delete:", error);
      toast.error("Failed to remove contacts");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    bulkChangeStage,
    bulkReassign,
    bulkAddTags,
    bulkRemoveTags,
    bulkDelete,
    isLoading
  };
};

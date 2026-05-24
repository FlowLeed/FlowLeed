import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Group {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  group_type: string;
  status: string;
  meeting_day?: string;
  meeting_time?: string;
  meeting_frequency?: string;
  location?: string;
  capacity?: number;
  leader_user_id?: string;
  co_leader_user_id?: string;
  tags?: string[];
  metadata?: any;
  pco_group_id?: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  visibility?: string;
  public_signup_token?: string;
  allow_public_signup?: boolean;
  image_url?: string | null;
}

export const useGroups = (organizationId: string | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("groups")
        .select(`
          *,
          local_member_count:group_members(count)
        `)
        .eq("organization_id", organizationId)
        .order("name");

      if (error) throw error;

      return data.map((group: any) => {
        const local = group.local_member_count?.[0]?.count || 0;
        // Prefer PCO-reported count when local join is empty (e.g. PCO members
        // not yet matched to FlowLeed contacts).
        const member_count = local > 0 ? local : (group.member_count || 0);
        return { ...group, member_count };
      });
    },
    enabled: !!organizationId,
  });

  const createGroup = useMutation({
    mutationFn: async (newGroup: Omit<Group, 'id' | 'created_at' | 'updated_at' | 'member_count'>) => {
      const { data, error } = await supabase
        .from("groups")
        .insert([newGroup])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast({
        title: "Group created",
        description: "The group has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Group> }) => {
      const { data, error } = await supabase
        .from("groups")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast({
        title: "Group updated",
        description: "The group has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("groups")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast({
        title: "Group deleted",
        description: "The group has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    groups: groups || [],
    isLoading,
    createGroup,
    updateGroup,
    deleteGroup,
  };
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface GroupMember {
  id: string;
  group_id: string;
  contact_id: string;
  role: string;
  status: string;
  joined_at: string;
  last_attended_at?: string;
  attendance_count: number;
  notes?: string;
  contact?: {
    name: string;
    email?: string;
    phone?: string;
    avatar?: string;
  };
}

export const useGroupMembers = (groupId: string | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await supabase
        .from("group_members")
        .select(`
          *,
          contact:contacts(name, email, phone, avatar)
        `)
        .eq("group_id", groupId)
        .order("joined_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  const addMember = useMutation({
    mutationFn: async (newMember: {
      group_id: string;
      contact_id: string;
      role?: string;
      status?: string;
    }) => {
      const { data, error } = await supabase
        .from("group_members")
        .insert([newMember])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast({
        title: "Member added",
        description: "The member has been added to the group.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<GroupMember> }) => {
      const { data, error } = await supabase
        .from("group_members")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members"] });
      toast({
        title: "Member updated",
        description: "The member information has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast({
        title: "Member removed",
        description: "The member has been removed from the group.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    members: members || [],
    isLoading,
    addMember,
    updateMember,
    removeMember,
  };
};

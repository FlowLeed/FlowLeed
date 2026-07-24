import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface GroupTypeDefinition {
  id: string;
  organization_id: string;
  key: string;
  label: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}

export const useGroupTypes = (organizationId: string | undefined, opts?: { includeInactive?: boolean }) => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["group-types", organizationId, opts?.includeInactive ?? false],
    enabled: !!organizationId,
    queryFn: async () => {
      let q = supabase
        .from("group_type_definitions" as any)
        .select("*")
        .eq("organization_id", organizationId!)
        .order("sort_order");
      if (!opts?.includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as GroupTypeDefinition[];
    },
  });

  const createType = useMutation({
    mutationFn: async (payload: Partial<GroupTypeDefinition>) => {
      const { data, error } = await (supabase as any)
        .from("group_type_definitions")
        .insert([{ ...payload, organization_id: organizationId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group-types"] });
      toast({ title: "Group type created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateType = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<GroupTypeDefinition> }) => {
      const { data, error } = await (supabase as any)
        .from("group_type_definitions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group-types"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("group_type_definitions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group-types"] });
      toast({ title: "Group type deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return { types, isLoading, createType, updateType, deleteType };
};

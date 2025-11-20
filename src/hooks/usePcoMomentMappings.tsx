import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PcoMomentMapping {
  id: string;
  organization_id: string;
  integration_id: string;
  pco_source_type: 'custom_tab_field' | 'group' | 'workflow';
  pco_source_identifier: string;
  pco_source_label: string;
  pco_tab_name?: string;
  flow_moment_type_id: string;
  trigger_condition: {
    operator: string;
    value: string;
  };
  is_active: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
  flow_moment_types?: {
    name: string;
    icon?: string;
    color?: string;
  };
}

export function usePcoMomentMappings(integrationId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: mappings, isLoading } = useQuery({
    queryKey: ['pco-moment-mappings', integrationId],
    queryFn: async () => {
      if (!integrationId) return [];
      const { data, error } = await supabase
        .from('pco_moment_mappings')
        .select('*, flow_moment_types(name, icon, color)')
        .eq('integration_id', integrationId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PcoMomentMapping[];
    },
    enabled: !!integrationId,
  });

  const createMapping = useMutation({
    mutationFn: async (data: Partial<PcoMomentMapping>) => {
      const { data: result, error } = await supabase
        .from('pco_moment_mappings')
        .insert([data as any])
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pco-moment-mappings'] });
      toast({
        title: "Success",
        description: "Mapping created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMapping = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PcoMomentMapping> }) => {
      const { error } = await supabase
        .from('pco_moment_mappings')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pco-moment-mappings'] });
      toast({
        title: "Success",
        description: "Mapping updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pco_moment_mappings')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pco-moment-mappings'] });
      toast({
        title: "Success",
        description: "Mapping deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    mappings: mappings || [],
    isLoading,
    createMapping,
    updateMapping,
    deleteMapping,
  };
}

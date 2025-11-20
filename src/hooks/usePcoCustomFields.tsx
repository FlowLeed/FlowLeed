import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PcoField {
  id: string;
  name: string;
  dataType: string;
  sequence: number;
  options: string[];
}

export interface PcoTab {
  tabName: string;
  fields: PcoField[];
}

export function usePcoCustomFields(integrationId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: fields, isLoading } = useQuery({
    queryKey: ['pco-custom-fields', integrationId],
    queryFn: async () => {
      if (!integrationId) return [];
      
      const { data, error } = await supabase.functions.invoke('pco-fetch-custom-fields', {
        body: { integration_id: integrationId, force_refresh: false },
      });
      
      if (error) throw error;
      return data?.tabs as PcoTab[] || [];
    },
    enabled: !!integrationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const refreshFields = useMutation({
    mutationFn: async () => {
      if (!integrationId) throw new Error('No integration ID');
      
      const { data, error } = await supabase.functions.invoke('pco-fetch-custom-fields', {
        body: { integration_id: integrationId, force_refresh: true },
      });
      
      if (error) throw error;
      return data?.tabs as PcoTab[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pco-custom-fields', integrationId] });
      toast({
        title: "Success",
        description: "Custom fields refreshed from Planning Center",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh fields",
        variant: "destructive",
      });
    },
  });

  return {
    fields: fields || [],
    isLoading,
    refreshFields,
  };
}

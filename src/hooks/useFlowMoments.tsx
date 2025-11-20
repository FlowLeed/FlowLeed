import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FlowMoment {
  id: string;
  contact_id: string;
  flow_moment_type_id: string;
  source_system: 'pco' | 'manual' | 'form';
  source_reference: string;
  occurred_at: string;
  metadata: any;
  created_at: string;
  flow_moment_types: {
    name: string;
    category: string;
    icon?: string;
    color?: string;
  };
}

export function useFlowMoments(contactId?: string) {
  return useQuery({
    queryKey: ['flow-moments', contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const { data, error } = await supabase
        .from('flow_moments')
        .select('*, flow_moment_types(name, category, icon, color)')
        .eq('contact_id', contactId)
        .order('occurred_at', { ascending: false });
      
      if (error) throw error;
      return data as FlowMoment[];
    },
    enabled: !!contactId,
  });
}

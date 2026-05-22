import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FlowMeta {
  id: string;
  name: string;
  icon: string;
}

export const useOrgFlowsMeta = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ["org-flows-meta", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<FlowMeta[]> => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name, icon")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        icon: p.icon || "Workflow",
      }));
    },
    staleTime: 60 * 1000,
  });
};

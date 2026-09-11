import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export interface SignalConditionOption {
  value: string;
  label: string;
}

export function useSignalConditionOptions() {
  const { organization } = useProfile();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ["signal-condition-options", orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!orgId) return { campuses: [], flows: [], stages: [], moments: [] };

      const [campusResult, flowResult, momentResult] = await Promise.all([
        supabase
          .from("campuses")
          .select("id, name")
          .eq("organization_id", orgId)
          .order("name"),
        supabase
          .from("pipelines")
          .select("id, name, pipeline_stages(id, name, stage_order)")
          .eq("organization_id", orgId)
          .order("name"),
        supabase
          .from("flow_moment_types")
          .select("id, name")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (campusResult.error) throw campusResult.error;
      if (flowResult.error) throw flowResult.error;
      if (momentResult.error) throw momentResult.error;

      const flows = (flowResult.data || []) as Array<{
        id: string;
        name: string;
        pipeline_stages: Array<{ id: string; name: string; stage_order: number }> | null;
      }>;

      return {
        campuses: (campusResult.data || []).map((item) => ({ value: item.id, label: item.name })),
        flows: flows.map((flow) => ({ value: flow.id, label: flow.name })),
        stages: flows.flatMap((flow) =>
          (flow.pipeline_stages || [])
            .sort((a, b) => a.stage_order - b.stage_order)
            .map((stage) => ({ value: stage.id, label: `${flow.name} — ${stage.name}` })),
        ),
        moments: (momentResult.data || []).map((item) => ({ value: item.id, label: item.name })),
      } satisfies Record<string, SignalConditionOption[]>;
    },
  });
}
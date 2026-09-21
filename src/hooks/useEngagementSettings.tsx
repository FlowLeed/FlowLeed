import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import {
  DEFAULT_ENGAGEMENT_SETTINGS,
  mergeEngagementSettings,
  type EngagementSettings,
} from "@/lib/engagementSettings";

export type EngagementPreview = {
  distribution: Record<string, number>;
  average_score: number;
  people_scored: number;
  samples: {
    contact_id: string;
    first_name: string | null;
    last_name: string | null;
    score: number;
    engagement_level: string;
    consecutive_weeks: number;
    weeks_window: number;
    breakdown: Record<string, unknown>;
  }[];
};

export function useEngagementSettings() {
  const { organization } = useProfile();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["engagement-settings", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<EngagementSettings> => {
      const { data, error } = await supabase
        .from("org_engagement_settings" as any)
        .select("*")
        .eq("organization_id", orgId ?? "")
        .maybeSingle();
      if (error) throw error;
      return mergeEngagementSettings(data as any);
    },
  });

  const save = useMutation({
    mutationFn: async ({ settings, recalculate }: { settings: EngagementSettings; recalculate: boolean }) => {
      if (!orgId) throw new Error("Organization not available");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("org_engagement_settings" as any).upsert(
        {
          organization_id: orgId,
          preset_key: settings.preset_key,
          weights: settings.weights,
          windows: settings.windows,
          thresholds: settings.thresholds,
          ingredients: settings.ingredients,
          labels: settings.labels,
          safeguards: settings.safeguards,
          updated_by: userData?.user?.id ?? null,
        } as any,
        { onConflict: "organization_id" },
      );
      if (error) throw error;
      if (recalculate) {
        const { error: rpcError } = await supabase.rpc("calculate_engagement_scores" as any, { p_org_id: orgId });
        if (rpcError) throw rpcError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engagement-settings", orgId] });
      queryClient.invalidateQueries({ queryKey: ["engagement-score"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  const preview = useMutation({
    mutationFn: async (settings: EngagementSettings): Promise<EngagementPreview> => {
      if (!orgId) throw new Error("Organization not available");
      const { data, error } = await supabase.rpc("preview_engagement_settings" as any, {
        p_org_id: orgId,
        p_settings: {
          weights: settings.weights,
          windows: settings.windows,
          thresholds: settings.thresholds,
          ingredients: settings.ingredients,
          safeguards: settings.safeguards,
        },
      });
      if (error) throw error;
      return data as unknown as EngagementPreview;
    },
  });

  return {
    settings: query.data ?? DEFAULT_ENGAGEMENT_SETTINGS,
    isLoading: query.isLoading,
    save,
    preview,
  };
}

/** Label names for the five engagement levels, using the church's custom wording. */
export function useEngagementLabels() {
  const { settings, isLoading } = useEngagementSettings();
  return { labels: settings.labels, isLoading };
}

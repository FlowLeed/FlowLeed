import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/features";

/**
 * Returns enabled state for each feature module for a given organization.
 * Default is ENABLED if no row exists (backwards compatible).
 */
export const useOrgFeaturesFor = (organizationId: string | null | undefined) => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["org-features", organizationId],
    queryFn: async () => {
      if (!organizationId) return {} as Record<string, boolean>;
      const { data, error } = await supabase
        .from("organization_features")
        .select("feature_key, enabled")
        .eq("organization_id", organizationId);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data || []).forEach((row: any) => {
        map[row.feature_key] = row.enabled;
      });
      return map;
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  });

  const isEnabled = (key: FeatureKey) => {
    if (!data) return true; // default-enabled while loading
    return data[key] !== false;
  };

  return { isEnabled, overrides: data || {}, isLoading, refetch };
};

/** Current user's org features. */
export const useOrgFeatures = () => {
  const { organization } = useProfile();
  return useOrgFeaturesFor(organization?.id);
};

export { FEATURE_KEYS };

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { toast } from "sonner";

export interface MarkerCatalogEntry {
  key: string;
  label: string;
  description: string;
  category: string;
  polarity: "positive" | "neutral" | "negative";
  sort_order: number;
  requires_integration: string | null;
  is_phase_two: boolean;
  contact_count: number;
  enabled: boolean;
  default_label: string;
  default_description: string;
  params: Record<string, number> | null;
  is_customized: boolean;
  promoted_signal_id: string | null;
}

export interface MarkerCatalogFilters {
  campusId?: string | null;
  assignedUserId?: string | null;
}

export function useMarkerCatalog(filters: MarkerCatalogFilters = {}) {
  const { organization } = useProfile();
  const { campusId = null, assignedUserId = null } = filters;
  return useQuery({
    queryKey: ["marker-catalog", organization?.id, campusId, assignedUserId],
    enabled: !!organization?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<MarkerCatalogEntry[]> => {
      if (!organization?.id) return [];
      const { data, error } = await supabase.rpc("get_marker_catalog" as any, {
        p_org_id: organization.id,
        p_campus_id: campusId,
        p_assigned_user_id: assignedUserId,
      });
      if (error) throw error;
      return ((data as any[]) || []) as MarkerCatalogEntry[];
    },
  });
}

export function useRecomputeMarkers() {
  const { organization } = useProfile();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error("No organization");
      const { error } = await supabase.rpc("recompute_contact_markers" as any, {
        p_org_id: organization.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marker-catalog"] });
      qc.invalidateQueries({ queryKey: ["contact-signal"] });
      qc.invalidateQueries({ queryKey: ["contact-markers-by-key"] });
      qc.invalidateQueries({ queryKey: ["all-contacts"] });
      toast.success("Signals recomputed");
    },
    onError: (e: any) => toast.error(e.message || "Failed to recompute"),
  });
}

export function useContactsWithMarker(markerKey: string | null) {
  const { organization } = useProfile();
  return useQuery({
    queryKey: ["contact-markers-by-key", organization?.id, markerKey],
    enabled: !!organization?.id && !!markerKey,
    queryFn: async (): Promise<string[]> => {
      if (!organization?.id || !markerKey) return [];
      const { data, error } = await supabase
        .from("contact_markers")
        .select("contact_id")
        .eq("organization_id", organization.id)
        .eq("marker_key", markerKey);
      if (error) throw error;
      return (data || []).map((r: any) => r.contact_id);
    },
  });
}

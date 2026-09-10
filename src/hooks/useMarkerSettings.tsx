import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { toast } from "sonner";

export interface MarkerSettingsInput {
  markerKey: string;
  enabled?: boolean;
  customLabel?: string | null;
  customDescription?: string | null;
  params?: Record<string, number>;
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["marker-catalog"] });
    qc.invalidateQueries({ queryKey: ["contact-signal"] });
    qc.invalidateQueries({ queryKey: ["contact-markers-by-key"] });
  };
}

export function useSaveMarkerSettings() {
  const { organization } = useProfile();
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async (input: MarkerSettingsInput) => {
      if (!organization?.id) throw new Error("No organization");
      const row: Record<string, any> = {
        organization_id: organization.id,
        marker_key: input.markerKey,
      };
      if (input.enabled !== undefined) row.enabled = input.enabled;
      if (input.customLabel !== undefined) row.custom_label = input.customLabel || null;
      if (input.customDescription !== undefined) row.custom_description = input.customDescription || null;
      if (input.params !== undefined) row.params = input.params;

      const { data, error } = await supabase
        .from("org_marker_settings" as any)
        .upsert(row, { onConflict: "organization_id,marker_key" })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("You need to be an owner or admin to change signals.");

      // Recompute so counts reflect the new settings right away.
      const { error: rpcError } = await supabase.rpc("recompute_contact_markers" as any, {
        p_org_id: organization.id,
      });
      if (rpcError) throw rpcError;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Signal updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update signal"),
  });
}

export function useResetMarkerSettings() {
  const { organization } = useProfile();
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async (markerKey: string) => {
      if (!organization?.id) throw new Error("No organization");
      const { error } = await supabase
        .from("org_marker_settings" as any)
        .delete()
        .eq("organization_id", organization.id)
        .eq("marker_key", markerKey);
      if (error) throw error;
      const { error: rpcError } = await supabase.rpc("recompute_contact_markers" as any, {
        p_org_id: organization.id,
      });
      if (rpcError) throw rpcError;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Signal reset to default");
    },
    onError: (e: any) => toast.error(e.message || "Failed to reset signal"),
  });
}

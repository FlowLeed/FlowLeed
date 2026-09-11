import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { toast } from "sonner";
import type {
  CustomSignalCondition,
  RuleCombinator,
  SignalPolarity,
  SignalSeverity,
} from "./useCustomSignals";

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
    qc.invalidateQueries({ queryKey: ["custom-signals"] });
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

export interface PromoteMarkerInput {
  markerKey: string;
  label: string;
  description?: string | null;
  polarity: SignalPolarity;
  severity: SignalSeverity;
  combinator: RuleCombinator;
  conditions: CustomSignalCondition[];
  /** Existing promoted signal to update instead of creating a new one. */
  existingSignalId?: string | null;
}

/**
 * Replaces a built-in signal's logic with a church-owned custom signal:
 * creates (or updates) the custom signal + rule, turns the built-in off,
 * and evaluates the new rule so counts appear right away.
 */
export function usePromoteMarkerToCustom() {
  const { organization } = useProfile();
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async (input: PromoteMarkerInput) => {
      if (!organization?.id) throw new Error("No organization");

      let signalId = input.existingSignalId || null;

      if (signalId) {
        const { data, error } = await supabase
          .from("custom_signals" as any)
          .update({
            label: input.label,
            description: input.description || null,
            polarity: input.polarity,
            severity: input.severity,
            enabled: true,
          })
          .eq("id", signalId)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("You need to be an owner or admin to change signals.");
      } else {
        const key = `builtin_${input.markerKey}`.slice(0, 60);
        const { data, error } = await supabase
          .from("custom_signals" as any)
          .insert({
            organization_id: organization.id,
            key,
            label: input.label,
            description: input.description || null,
            polarity: input.polarity,
            severity: input.severity,
            category: "Custom",
          })
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("You need to be an owner or admin to change signals.");
        signalId = (data as any).id as string;
      }

      const { error: ruleErr } = await supabase
        .from("custom_signal_rules" as any)
        .upsert(
          {
            signal_id: signalId,
            rule_combinator: input.combinator,
            conditions: input.conditions as any,
          },
          { onConflict: "signal_id" }
        );
      if (ruleErr) throw ruleErr;

      const { data: settings, error: settingsErr } = await supabase
        .from("org_marker_settings" as any)
        .upsert(
          {
            organization_id: organization.id,
            marker_key: input.markerKey,
            enabled: false,
            custom_label: input.label,
            custom_description: input.description || null,
            promoted_signal_id: signalId,
          },
          { onConflict: "organization_id,marker_key" }
        )
        .select("id")
        .maybeSingle();
      if (settingsErr) throw settingsErr;
      if (!settings) throw new Error("You need to be an owner or admin to change signals.");

      const { error: rpcError } = await supabase.rpc("recompute_contact_markers" as any, {
        p_org_id: organization.id,
      });
      if (rpcError) throw rpcError;

      await supabase.functions.invoke("evaluate-custom-signals", {
        body: { organization_id: organization.id },
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Signal logic saved");
    },
    onError: (e: any) => toast.error(e.message || "Failed to save signal logic"),
  });
}

export function useResetMarkerSettings() {
  const { organization } = useProfile();
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async (markerKey: string) => {
      if (!organization?.id) throw new Error("No organization");

      const { data: existing } = await supabase
        .from("org_marker_settings" as any)
        .select("promoted_signal_id")
        .eq("organization_id", organization.id)
        .eq("marker_key", markerKey)
        .maybeSingle();

      const promotedId = (existing as any)?.promoted_signal_id as string | undefined;

      const { error } = await supabase
        .from("org_marker_settings" as any)
        .delete()
        .eq("organization_id", organization.id)
        .eq("marker_key", markerKey);
      if (error) throw error;

      if (promotedId) {
        const { error: delErr } = await supabase
          .from("custom_signals" as any)
          .delete()
          .eq("id", promotedId);
        if (delErr) throw delErr;
      }

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

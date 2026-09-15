import { useQuery, useMutation, useQueryClient, useIsMutating } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { toast } from "sonner";

export type SignalPolarity = "positive" | "neutral" | "negative";
export type SignalSeverity = "info" | "watch" | "risk";
export type RuleCombinator = "AND" | "OR";
export type SignalVisibility = "org" | "personal";

export interface CustomSignalCondition {
  /** e.g. attendance.last_service_days_ago, group.attendance_rate, tag.has, pco_field */
  source: string;
  operator: string;
  value: any;
  label?: string;
  condition_group?: number;
}

export interface CustomSignal {
  id: string;
  organization_id: string;
  key: string;
  label: string;
  description: string | null;
  polarity: SignalPolarity;
  category: string;
  severity: SignalSeverity;
  visibility: SignalVisibility;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  contact_count?: number;
  rule?: {
    combinator: RuleCombinator;
    conditions: CustomSignalCondition[];
  } | null;
}

export function useCustomSignals() {
  const { organization } = useProfile();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["custom-signals", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<CustomSignal[]> => {
      if (!orgId) return [];
      const { data: signals, error } = await supabase
        .from("custom_signals" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: rules } = await supabase
        .from("custom_signal_rules" as any)
        .select("*")
        .in("signal_id", (signals || []).map((s: any) => s.id));

      const { data: matches } = await supabase
        .from("custom_signal_contacts" as any)
        .select("signal_id")
        .in("signal_id", (signals || []).map((s: any) => s.id))
        .is("cleared_at", null);

      const rulesBySignal: Record<string, any> = {};
      (rules || []).forEach((r: any) => (rulesBySignal[r.signal_id] = r));
      const countBySignal: Record<string, number> = {};
      (matches || []).forEach((m: any) => {
        countBySignal[m.signal_id] = (countBySignal[m.signal_id] || 0) + 1;
      });

      return (signals || []).map((s: any) => ({
        ...s,
        contact_count: countBySignal[s.id] || 0,
        rule: rulesBySignal[s.id]
          ? {
              combinator: rulesBySignal[s.id].rule_combinator as RuleCombinator,
              conditions: rulesBySignal[s.id].conditions as CustomSignalCondition[],
            }
          : null,
      }));
    },
  });

  /** Pulls matching people for this org's signals right after a change. */
  const evaluate = useMutation({
    mutationKey: ["evaluate-custom-signals", orgId],
    mutationFn: async () => {
      if (!orgId) return;
      const { error } = await supabase.functions.invoke("evaluate-custom-signals", {
        body: { organization_id: orgId },
      });
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["custom-signals", orgId] });
    },
  });

  const isEvaluating = useIsMutating({ mutationKey: ["evaluate-custom-signals"] }) > 0;

  const create = useMutation({
    mutationFn: async (input: {
      label: string;
      description?: string;
      polarity: SignalPolarity;
      severity: SignalSeverity;
      visibility?: SignalVisibility;
      category?: string;
      combinator: RuleCombinator;
      conditions: CustomSignalCondition[];
    }) => {
      if (!orgId) throw new Error("No organization");
      const key = input.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: signal, error } = await supabase
        .from("custom_signals" as any)
        .insert({
          organization_id: orgId,
          key,
          label: input.label,
          description: input.description || null,
          polarity: input.polarity,
          severity: input.severity,
          visibility: input.visibility || "org",
          created_by: user?.id ?? null,
          category: input.category || "Custom",
        })
        .select()
        .single();
      if (error) throw error;
      const { error: ruleErr } = await supabase
        .from("custom_signal_rules" as any)
        .insert({
          signal_id: (signal as any).id,
          rule_combinator: input.combinator,
          conditions: input.conditions as any,
        });
      if (ruleErr) throw ruleErr;
      return signal;
    },
    onSuccess: () => {
      toast.success("Signal created — finding matching people…");
      qc.invalidateQueries({ queryKey: ["custom-signals", orgId] });
      evaluate.mutate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (input: {
      id: string;
      label?: string;
      description?: string;
      polarity?: SignalPolarity;
      severity?: SignalSeverity;
      visibility?: SignalVisibility;
      enabled?: boolean;
      combinator?: RuleCombinator;
      conditions?: CustomSignalCondition[];
    }) => {
      const { id, combinator, conditions, ...patch } = input;
      if (Object.keys(patch).length) {
        const { error } = await supabase
          .from("custom_signals" as any)
          .update(patch)
          .eq("id", id);
        if (error) throw error;
      }
      if (combinator && conditions) {
        const { error } = await supabase
          .from("custom_signal_rules" as any)
          .upsert(
            { signal_id: id, rule_combinator: combinator, conditions: conditions as any },
            { onConflict: "signal_id" }
          );
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["custom-signals", orgId] });
      // Only re-pull people when the rule or on/off state actually changed
      if (vars.conditions || vars.enabled !== undefined) evaluate.mutate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_signals" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Signal deleted");
      qc.invalidateQueries({ queryKey: ["custom-signals", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { list, create, update, remove };
}

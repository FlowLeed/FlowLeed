import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { toast } from "sonner";

export type AgentActionType = "notify" | "add_to_flow" | "create_task" | "draft_message";
export type SuggestionStatus = "pending" | "approved" | "dismissed" | "expired";

export interface AgentSuggestion {
  id: string;
  organization_id: string;
  contact_id: string;
  signal_key: string;
  signal_source: "builtin" | "custom";
  action_type: AgentActionType;
  action_payload: Record<string, any>;
  reasoning: string | null;
  confidence: number | null;
  status: SuggestionStatus;
  assignee_user_id: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  executed_at: string | null;
  created_at: string;
  contact?: { id: string; first_name: string | null; last_name: string | null; email: string | null };
}

export interface AgentConfig {
  id?: string;
  organization_id: string;
  enabled: boolean;
  watch_signals: string[];
  allowed_actions: AgentActionType[];
  default_assignee_strategy: "assigned_user" | "campus_pastor" | "flow_owner";
  quiet_hours: { start: string; end: string };
  max_suggestions_per_day: number;
}

export function useAgentSuggestions(status: SuggestionStatus = "pending") {
  const { organization } = useProfile();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["signal-agent-suggestions", orgId, status],
    enabled: !!orgId,
    queryFn: async (): Promise<AgentSuggestion[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("signal_agent_suggestions" as any)
        .select("*, contact:contacts(id, first_name, last_name, email)")
        .eq("organization_id", orgId)
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const review = useMutation({
    mutationFn: async (input: { id: string; decision: "approved" | "dismissed" }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("signal_agent_suggestions" as any)
        .update({
          status: input.decision,
          reviewer_id: userRes.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.decision === "approved" ? "Approved" : "Dismissed");
      qc.invalidateQueries({ queryKey: ["signal-agent-suggestions", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { list, review };
}

export function useAgentConfig() {
  const { organization } = useProfile();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["signal-agent-config", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<AgentConfig | null> => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("signal_agent_configs" as any)
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...(data as any),
        watch_signals: (data as any).watch_signals || [],
        allowed_actions: (data as any).allowed_actions || ["notify"],
      };
    },
  });

  const save = useMutation({
    mutationFn: async (input: Partial<AgentConfig>) => {
      if (!orgId) throw new Error("No organization");
      const { error } = await supabase
        .from("signal_agent_configs" as any)
        .upsert(
          { organization_id: orgId, ...input },
          { onConflict: "organization_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agent settings saved");
      qc.invalidateQueries({ queryKey: ["signal-agent-config", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { query, save };
}

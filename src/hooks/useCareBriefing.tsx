import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

export type CareKind = "life_moment" | "faith_moment" | "drift" | "follow_up";
export type CareConnection = { user_id: string; name: string; role: string; why: string; confidence: string } | null;
export type CareRecommendation = {
  id: string;
  organization_id: string;
  contact_id: string;
  briefing_date: string;
  kind: CareKind;
  headline: string;
  why: string;
  known: string[];
  best_connection: CareConnection;
  sensitive: boolean;
  status: "pending" | "taking" | "delegated" | "handled" | "snoozed" | "dismissed";
  outcome: string | null;
  follow_up_of: string | null;
  contact?: { id: string; name: string | null } | null;
};

export type BriefingTask = {
  id: string;
  title: string;
  due_at: string;
  contact_id: string | null;
  contact?: { id: string; name: string | null } | null;
};

const db = supabase as any;
const DAY = 86400000;
const iso = (d: number) => new Date(Date.now() + d * DAY).toISOString();

export function useCareBriefing() {
  const { user } = useAuth();
  const { organization } = useProfile();
  const qc = useQueryClient();
  const key = ["care-briefing", user?.id, organization?.id];

  const list = useQuery({
    queryKey: key,
    enabled: !!user?.id && !!organization?.id,
    queryFn: async (): Promise<CareRecommendation[]> => {
      const { data, error } = await db
        .from("care_recommendations")
        .select("*, contact:contacts(id, name)")
        .eq("recipient_user_id", user!.id)
        .eq("organization_id", organization!.id)
        .gte("briefing_date", new Date(Date.now() - 14 * DAY).toISOString().slice(0, 10))
        .order("briefing_date", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const status = useQuery({
    queryKey: ["care-agent-state", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => (await db.from("care_agent_state").select("paused_reason, last_run_date").eq("organization_id", organization!.id).maybeSingle()).data,
  });

  const todos = useQuery({
    queryKey: ["care-briefing-todos", user?.id, organization?.id],
    enabled: !!user?.id && !!organization?.id,
    queryFn: async (): Promise<BriefingTask[]> => {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const { data, error } = await db
        .from("tasks")
        .select("id, title, due_at, contact_id, contact:contacts(id, name)")
        .eq("assigned_to_user_id", user!.id)
        .eq("organization_id", organization!.id)
        .is("completed_at", null)
        .not("due_at", "is", null)
        .lte("due_at", endOfToday.toISOString())
        .order("due_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["care-briefing-todos", user?.id, organization?.id] });
  };

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await db.from("care_recommendations").update({ ...patch, acted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  };

  const run = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("care-agent-run", { body: { organizationId: organization?.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d: any) => {
      refresh();
      if (d?.skipped) toast.message("Today's briefing is already being prepared.");
      else if (!d?.created) toast.message("No one new needs you today. That's a good thing.");
    },
    onError: (e: any) => toast.error(e?.message || "Couldn't prepare the briefing."),
  });

  const takeCare = useMutation({
    mutationFn: async (r: CareRecommendation) => {
      const name = r.contact?.name ?? "this person";
      const { data: t, error } = await db.from("tasks").insert({
        organization_id: r.organization_id, title: `Check in with ${name}`, description: r.sensitive ? "Private care — details on their profile." : r.why,
        contact_id: r.contact_id, assigned_to_user_id: user!.id, created_by_user_id: user!.id, due_at: iso(1),
      }).select("id").single();
      if (error) throw error;
      await update(r.id, { status: "taking", task_id: t.id, follow_up_at: iso(7) });
    },
    onSuccess: () => { toast.success("Added to your tasks. I'll remind you to check back in a week."); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const delegate = useMutation({
    mutationFn: async ({ r, message }: { r: CareRecommendation; message: string }) => {
      const c = r.best_connection; if (!c) throw new Error("No connection to ask.");
      const { data: t, error } = await db.from("tasks").insert({
        organization_id: r.organization_id, title: `Check in with ${r.contact?.name ?? "someone"}`, description: message,
        contact_id: r.contact_id, assigned_to_user_id: c.user_id, created_by_user_id: user!.id, due_at: iso(2),
      }).select("id").single();
      if (error) throw error;
      await update(r.id, { status: "delegated", task_id: t.id, delegated_to_user_id: c.user_id, follow_up_at: iso(7) });
    },
    onSuccess: () => { toast.success("Sent. It's in their Tasks now."); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const handled = useMutation({
    mutationFn: async ({ r, outcome, note }: { r: CareRecommendation; outcome: string; note: string }) => {
      if (outcome !== "someone_else") {
        const { error } = await db.from("contact_interactions").insert({
          contact_id: r.contact_id, interaction_type: "care_check_in", subject: OUTCOMES[outcome] ?? "Care check-in",
          details: note || null, completed_at: new Date().toISOString(), created_by_user_id: user!.id, metadata: { source: "care_briefing", recommendation_id: r.id },
        });
        if (error) throw error;
      }
      await update(r.id, { status: "handled", outcome, outcome_note: note || null, follow_up_at: outcome === "no_follow_up" ? null : iso(14) });
    },
    onSuccess: () => { toast.success("Saved to their profile."); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const snooze = useMutation({
    mutationFn: (r: CareRecommendation) => update(r.id, { status: "snoozed", snoozed_until: iso(7) }),
    onSuccess: () => { toast.success("Snoozed for a week."); refresh(); },
  });
  const dismiss = useMutation({
    mutationFn: (r: CareRecommendation) => update(r.id, { status: "dismissed" }),
    onSuccess: refresh,
  });

  const completeTodo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("tasks")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("assigned_to_user_id", user!.id)
        .eq("organization_id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Task completed."); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  return { list, status, todos, run, takeCare, delegate, handled, snooze, dismiss, completeTodo };
}

export const OUTCOMES: Record<string, string> = {
  spoke: "Spoke with them",
  messaged: "Sent a message",
  someone_else: "Someone else is caring for them",
  no_follow_up: "No follow-up needed",
};

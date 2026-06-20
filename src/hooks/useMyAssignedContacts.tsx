import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MyAssignedContact {
  id: string;
  name: string;
  avatar: string | null;
  email: string | null;
  campusId: string | null;
  campusName: string | null;
  daysSinceLastContact: number;
  lastInteractionDate: string | null;
  flowId: string | null;
  flowName: string | null;
  flowIcon: string | null;
  stageId: string | null;
  stageName: string | null;
  stageColor: string | null;
  nextStageName: string | null;
  assignedAt: string | null;
  source: "direct" | "stage_default" | "interaction";
}

export const useMyAssignedContacts = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["my-assigned-contacts", userId],
    queryFn: async (): Promise<MyAssignedContact[]> => {
      if (!userId) throw new Error("User ID is required");

      // 1. Direct pipeline_contacts assignments
      // 2. Stages where I'm default assignee (capture stage_ids)
      // 3. Open interactions assigned to me
      const [directRes, defaultStagesRes, interactionsAssignedRes] = await Promise.all([
        supabase
          .from("pipeline_contacts")
          .select("contact_id, pipeline_id, stage_id, stage_entered_at, assigned_to_user_id, completed_end_at")
          .eq("assigned_to_user_id", userId)
          .is("completed_end_at", null),
        supabase
          .from("pipeline_stages")
          .select("id")
          .eq("default_assignee_user_id", userId),
        supabase
          .from("contact_interactions")
          .select("contact_id")
          .eq("assigned_to_user_id", userId)
          .is("completed_at", null),
      ]);

      const direct = directRes.data || [];
      const defaultStageIds = (defaultStagesRes.data || []).map((s) => s.id);

      // Fetch pipeline_contacts that fall under stages where I'm default assignee but have no explicit assignee
      let defaultAssigned: any[] = [];
      if (defaultStageIds.length > 0) {
        const { data } = await supabase
          .from("pipeline_contacts")
          .select("contact_id, pipeline_id, stage_id, stage_entered_at, assigned_to_user_id, completed_end_at")
          .in("stage_id", defaultStageIds)
          .is("assigned_to_user_id", null)
          .is("completed_end_at", null);
        defaultAssigned = data || [];
      }

      const interactionContactIds = [
        ...new Set((interactionsAssignedRes.data || []).map((i) => i.contact_id)),
      ];

      // Pick a "primary" pipeline_contact per contact (most recently entered active one).
      // direct takes precedence over default.
      const primaryByContact = new Map<
        string,
        { row: any; source: "direct" | "stage_default" }
      >();

      const consider = (row: any, source: "direct" | "stage_default") => {
        const existing = primaryByContact.get(row.contact_id);
        if (!existing) {
          primaryByContact.set(row.contact_id, { row, source });
          return;
        }
        if (existing.source === "stage_default" && source === "direct") {
          primaryByContact.set(row.contact_id, { row, source });
          return;
        }
        if (existing.source === source) {
          const a = new Date(existing.row.stage_entered_at || 0).getTime();
          const b = new Date(row.stage_entered_at || 0).getTime();
          if (b > a) primaryByContact.set(row.contact_id, { row, source });
        }
      };

      for (const r of direct) consider(r, "direct");
      for (const r of defaultAssigned) consider(r, "stage_default");

      // Collect every relevant contactId
      const allContactIds = new Set<string>([
        ...primaryByContact.keys(),
        ...interactionContactIds,
      ]);
      if (allContactIds.size === 0) return [];

      const contactIds = [...allContactIds];
      const pipelineIds = [
        ...new Set(
          [...primaryByContact.values()].map((v) => v.row.pipeline_id).filter(Boolean),
        ),
      ];

      const [contactsRes, pipelinesRes, stagesRes, interactionsRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("id, name, avatar, email, campus_id")
          .in("id", contactIds),
        pipelineIds.length
          ? supabase.from("pipelines").select("id, name, icon").in("id", pipelineIds)
          : Promise.resolve({ data: [] as any[] }),
        pipelineIds.length
          ? supabase
              .from("pipeline_stages")
              .select("id, name, color, stage_order, pipeline_id")
              .in("pipeline_id", pipelineIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("contact_interactions")
          .select("contact_id, created_at")
          .in("contact_id", contactIds)
          .order("created_at", { ascending: false }),
      ]);

      const contacts = contactsRes.data || [];
      const pipelines = (pipelinesRes.data as any[]) || [];
      const allStages = (stagesRes.data as any[]) || [];
      const interactions = interactionsRes.data || [];

      const campusIds = [...new Set(contacts.map((c) => c.campus_id).filter(Boolean))] as string[];
      const campusesRes = campusIds.length
        ? await supabase.from("campuses").select("id, name").in("id", campusIds)
        : { data: [] as any[] };
      const campusMap = new Map(((campusesRes.data as any[]) || []).map((c) => [c.id, c.name]));

      const pipelineMap = new Map(pipelines.map((p) => [p.id, p]));
      const stageMap = new Map(allStages.map((s) => [s.id, s]));
      const nextStageMap = new Map<string, string>();
      for (const stage of allStages) {
        const next = allStages.find(
          (s) => s.pipeline_id === stage.pipeline_id && s.stage_order === stage.stage_order + 1,
        );
        if (next) nextStageMap.set(stage.id, next.name);
      }

      const lastInteractionByContact = new Map<string, string>();
      for (const i of interactions) {
        if (!lastInteractionByContact.has(i.contact_id)) {
          lastInteractionByContact.set(i.contact_id, i.created_at);
        }
      }

      const result: MyAssignedContact[] = contacts.map((c) => {
        const primary = primaryByContact.get(c.id);
        const last = lastInteractionByContact.get(c.id) || null;
        const days = last
          ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000)
          : 999;
        const pipeline = primary ? pipelineMap.get(primary.row.pipeline_id) : null;
        const stage = primary ? stageMap.get(primary.row.stage_id) : null;
        const source: MyAssignedContact["source"] = primary
          ? primary.source
          : "interaction";

        return {
          id: c.id,
          name: c.name,
          avatar: c.avatar,
          email: c.email,
          campusId: c.campus_id,
          campusName: c.campus_id ? campusMap.get(c.campus_id) || null : null,
          daysSinceLastContact: days,
          lastInteractionDate: last,
          flowId: primary?.row.pipeline_id || null,
          flowName: (pipeline as any)?.name || null,
          flowIcon: (pipeline as any)?.icon || null,
          stageId: primary?.row.stage_id || null,
          stageName: (stage as any)?.name || null,
          stageColor: (stage as any)?.color || null,
          nextStageName: primary ? nextStageMap.get(primary.row.stage_id) || null : null,
          assignedAt: primary?.row.stage_entered_at || null,
          source,
        };
      });

      return result;
    },
    enabled: !!userId,
  });
};

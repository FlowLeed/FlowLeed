import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TaskContact {
  id: string;
  name: string;
  avatar: string | null;
  email: string | null;
  daysSinceLastContact: number;
  lastInteractionDate: string | null;
  flowName: string | null;
  flowIcon: string | null;
  flowId: string | null;
  stageName: string | null;
  stageColor: string | null;
  nextStageName: string | null;
}

export const useTasksPageData = (userId: string | undefined, daysThreshold: number = 5) => {
  return useQuery({
    queryKey: ["tasks-page-contacts", userId, daysThreshold],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");

      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

      // Get pipeline contacts assigned to me with stage + pipeline info
      const { data: myPipelineContacts } = await supabase
        .from("pipeline_contacts")
        .select(`
          contact_id,
          pipeline_id,
          stage_id,
          stage_order
        `)
        .eq("assigned_to_user_id", userId)
        .is("completed_end_at", null);

      if (!myPipelineContacts || myPipelineContacts.length === 0) return [];

      const contactIds = [...new Set(myPipelineContacts.map((c) => c.contact_id))];
      const pipelineIds = [...new Set(myPipelineContacts.map((c) => c.pipeline_id))];
      const stageIds = [...new Set(myPipelineContacts.map((c) => c.stage_id))];

      // Fetch contacts, pipelines, stages, and interactions in parallel
      const [contactsRes, pipelinesRes, stagesRes, interactionsRes] = await Promise.all([
        supabase.from("contacts").select("id, name, avatar, email").in("id", contactIds),
        supabase.from("pipelines").select("id, name, icon").in("id", pipelineIds),
        supabase.from("pipeline_stages").select("id, name, color, stage_order, pipeline_id").in("pipeline_id", pipelineIds),
        supabase.from("contact_interactions").select("contact_id, created_at").in("contact_id", contactIds).order("created_at", { ascending: false }),
      ]);

      const contacts = contactsRes.data || [];
      const pipelines = pipelinesRes.data || [];
      const allStages = stagesRes.data || [];
      const interactions = interactionsRes.data || [];

      // Build lookup maps
      const pipelineMap = new Map(pipelines.map((p) => [p.id, p]));
      const stageMap = new Map(allStages.map((s) => [s.id, s]));

      // Build next stage map: for each stage, find the next one by stage_order in same pipeline
      const nextStageMap = new Map<string, string>();
      for (const stage of allStages) {
        const nextStage = allStages.find(
          (s) => s.pipeline_id === stage.pipeline_id && s.stage_order === stage.stage_order + 1
        );
        if (nextStage) nextStageMap.set(stage.id, nextStage.name);
      }

      // Build result
      const contactMap = new Map<string, TaskContact>();

      for (const pc of myPipelineContacts) {
        const contact = contacts.find((c) => c.id === pc.contact_id);
        if (!contact) continue;

        // Skip if we already have this contact (use first pipeline entry)
        if (contactMap.has(contact.id)) continue;

        const lastInteraction = interactions.find((i) => i.contact_id === contact.id);
        const daysSinceLastContact = lastInteraction
          ? Math.floor((Date.now() - new Date(lastInteraction.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        const pipeline = pipelineMap.get(pc.pipeline_id);
        const stage = stageMap.get(pc.stage_id);

        contactMap.set(contact.id, {
          id: contact.id,
          name: contact.name,
          avatar: contact.avatar,
          email: contact.email,
          daysSinceLastContact,
          lastInteractionDate: lastInteraction?.created_at || null,
          flowName: pipeline?.name || null,
          flowIcon: pipeline?.icon || null,
          flowId: pc.pipeline_id,
          stageName: stage?.name || null,
          stageColor: stage?.color || null,
          nextStageName: nextStageMap.get(pc.stage_id) || null,
        });
      }

      return Array.from(contactMap.values())
        .filter((c) => !c.lastInteractionDate || new Date(c.lastInteractionDate) < thresholdDate)
        .sort((a, b) => b.daysSinceLastContact - a.daysSinceLastContact);
    },
    enabled: !!userId,
  });
};

// Extended version of useMyUpcomingTasks without limit, including overdue
export const useAllScheduledTasks = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["all-scheduled-tasks", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");

      const { data: interactions } = await supabase
        .from("contact_interactions")
        .select("id, subject, scheduled_at, interaction_type, contact_id, completed_at")
        .or(`assigned_to_user_id.eq.${userId},created_by_user_id.eq.${userId}`)
        .not("scheduled_at", "is", null)
        .order("scheduled_at", { ascending: true });

      if (!interactions || interactions.length === 0) return [];

      const contactIds = [...new Set(interactions.map((i) => i.contact_id))];
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, avatar")
        .in("id", contactIds);

      const contactMap = new Map(contacts?.map((c) => [c.id, c]) || []);

      return interactions.map((task) => ({
        ...task,
        contact: contactMap.get(task.contact_id) || null,
      }));
    },
    enabled: !!userId,
  });
};

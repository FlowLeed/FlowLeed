import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useMyUpcomingTasks = (userId: string | undefined, limit: number = 5) => {
  return useQuery({
    queryKey: ["my-upcoming-tasks", userId, limit],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");

      const { data: interactions } = await supabase
        .from("contact_interactions")
        .select("id, subject, scheduled_at, interaction_type, contact_id")
        .or(`assigned_to_user_id.eq.${userId},created_by_user_id.eq.${userId}`)
        .not("scheduled_at", "is", null)
        .is("completed_at", null)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(limit);

      if (!interactions || interactions.length === 0) return [];

      const contactIds = [...new Set(interactions.map((i) => i.contact_id))];
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, avatar")
        .in("id", contactIds);

      const contactMap = new Map(contacts?.map((c) => [c.id, c]) || []);

      return interactions.map((task) => ({
        ...task,
        contacts: contactMap.get(task.contact_id) || null,
      }));
    },
    enabled: !!userId,
  });
};

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useTeamActivityFeed = (
  organizationId: string | undefined,
  limit: number = 5
) => {
  return useQuery({
    queryKey: ["team-activity-feed", organizationId, limit],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization ID is required");

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: interactions } = await supabase
        .from("contact_interactions")
        .select("id, interaction_type, subject, created_at, created_by_user_id, metadata, contact_id")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!interactions || interactions.length === 0) return [];

      const contactIds = [...new Set(interactions.map((i) => i.contact_id))];
      const userIds = [...new Set(interactions.map((i) => i.created_by_user_id))];

      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name")
        .in("id", contactIds);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);

      const contactMap = new Map(contacts?.map((c) => [c.id, c]) || []);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      return interactions.map((activity) => ({
        ...activity,
        contacts: contactMap.get(activity.contact_id) || null,
        profiles: profileMap.get(activity.created_by_user_id) || null,
      }));
    },
    enabled: !!organizationId,
  });
};

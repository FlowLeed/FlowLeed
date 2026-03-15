import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useMyContactsNeedingAttention = (
  userId: string | undefined,
  daysThreshold: number = 5,
  limit: number = 5
) => {
  return useQuery({
    queryKey: ["contacts-needing-attention", userId, daysThreshold, limit],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");

      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

      // Get contacts assigned to me
      const { data: myPipelineContacts } = await supabase
        .from("pipeline_contacts")
        .select("contact_id, pipeline_id, pipelines(name, icon)")
        .eq("assigned_to_user_id", userId);

      if (!myPipelineContacts || myPipelineContacts.length === 0) {
        return [];
      }

      const contactIds = [...new Set(myPipelineContacts.map((c) => c.contact_id))];

      // Get contact details
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, avatar, email, campus_id, campuses(name)")
        .in("id", contactIds);

      // Get last interaction for each contact
      const { data: lastInteractions } = await supabase
        .from("contact_interactions")
        .select("contact_id, created_at")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false });

      // Build contact map with last interaction
      const contactMap = new Map();
      contacts?.forEach((contact) => {
        const lastInteraction = lastInteractions?.find(
          (i) => i.contact_id === contact.id
        );
        const daysSinceLastContact = lastInteraction
          ? Math.floor(
              (Date.now() - new Date(lastInteraction.created_at).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 999;

        const pipelineContact = myPipelineContacts.find(
          (pc) => pc.contact_id === contact.id
        );

        contactMap.set(contact.id, {
          ...contact,
          lastInteractionDate: lastInteraction?.created_at || null,
          daysSinceLastContact,
          flow: pipelineContact?.pipelines || null,
        });
      });

      // Filter and sort
      const needingAttention = Array.from(contactMap.values())
        .filter(
          (c) =>
            !c.lastInteractionDate ||
            new Date(c.lastInteractionDate) < thresholdDate
        )
        .sort((a, b) => b.daysSinceLastContact - a.daysSinceLastContact)
        .slice(0, limit);

      return needingAttention;
    },
    enabled: !!userId,
  });
};

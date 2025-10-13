import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { ContactFilters } from "@/pages/ContactsPage";

export const useContacts = (filters: ContactFilters) => {
  const { user } = useAuth();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["all-contacts", user?.id, filters],
    queryFn: async () => {
      if (!user) return [];

      // Get user's organization
      const { data: orgMember } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!orgMember) return [];

      // Build base query
      let query = supabase
        .from("contacts")
        .select(`
          *,
          contact_tags(tag),
          pipeline_contacts(
            pipeline_id,
            pipelines(id, name, icon)
          ),
          profiles!contacts_assigned_to_user_id_fkey(
            user_id,
            full_name,
            avatar_url
          )
        `)
        .eq("organization_id", orgMember.organization_id)
        .order("created_at", { ascending: false });

      // Apply search filter
      if (filters.searchTerm) {
        query = query.or(
          `name.ilike.%${filters.searchTerm}%,email.ilike.%${filters.searchTerm}%,phone.ilike.%${filters.searchTerm}%`
        );
      }

      // Apply assigned filter
      if (filters.assignedToUserId !== "all") {
        if (filters.assignedToUserId === "unassigned") {
          query = query.is("assigned_to_user_id", null);
        } else {
          query = query.eq("assigned_to_user_id", filters.assignedToUserId);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data || [];

      // Apply flow filter (client-side since it's a nested relationship)
      if (filters.flowId !== "all") {
        if (filters.flowId === "no-flows") {
          filteredData = filteredData.filter(
            (contact) => !contact.pipeline_contacts || contact.pipeline_contacts.length === 0
          );
        } else {
          filteredData = filteredData.filter((contact) =>
            contact.pipeline_contacts?.some((pc: any) => pc.pipeline_id === filters.flowId)
          );
        }
      }

      // Apply last interaction filter
      if (filters.lastInteractionDays !== "all") {
        // Get contact interactions for filtering
        const { data: interactions } = await supabase
          .from("contact_interactions")
          .select("contact_id, created_at")
          .in(
            "contact_id",
            filteredData.map((c) => c.id)
          )
          .order("created_at", { ascending: false });

        const contactLastInteraction = new Map();
        interactions?.forEach((interaction) => {
          if (!contactLastInteraction.has(interaction.contact_id)) {
            contactLastInteraction.set(interaction.contact_id, new Date(interaction.created_at));
          }
        });

        const now = new Date();
        const daysMap: Record<string, number> = {
          "7": 7,
          "30": 30,
          "90": 90,
        };

        filteredData = filteredData.filter((contact) => {
          const lastInteraction = contactLastInteraction.get(contact.id);

          if (filters.lastInteractionDays === "never") {
            return !lastInteraction;
          }

          if (!lastInteraction) return false;

          const days = daysMap[filters.lastInteractionDays];
          const daysDiff = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff <= days;
        });
      }

      // Get last interaction for each contact
      const contactIds = filteredData.map((c) => c.id);
      if (contactIds.length > 0) {
        const { data: interactions } = await supabase
          .from("contact_interactions")
          .select("contact_id, created_at")
          .in("contact_id", contactIds)
          .order("created_at", { ascending: false });

        const lastInteractionMap = new Map();
        interactions?.forEach((interaction) => {
          if (!lastInteractionMap.has(interaction.contact_id)) {
            lastInteractionMap.set(interaction.contact_id, interaction.created_at);
          }
        });

        filteredData = filteredData.map((contact) => ({
          ...contact,
          lastInteraction: lastInteractionMap.get(contact.id),
        }));
      }

      return filteredData;
    },
    enabled: !!user,
  });

  return { contacts, isLoading };
};

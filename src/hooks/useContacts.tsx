import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { ContactFilters } from "@/pages/ContactsPage";

export const useContacts = (filters: ContactFilters) => {
  const { user } = useAuth();

  console.log('🔍 useContacts hook called', { user: user?.id, filters });

  const { data: contacts, isLoading, error } = useQuery({
    queryKey: ["all-contacts", user?.id, filters],
    retry: false,
    queryFn: async () => {
      console.log('📊 useContacts queryFn executing', { userId: user?.id });
      
      if (!user) {
        console.log('❌ No user found in useContacts');
        return [];
      }

      // Get user's active organization (from localStorage or first available)
      console.log('🔍 Fetching organization for user:', user.id);
      
      let organizationId: string | null = null;
      
      // Try to get the saved organization from localStorage
      const savedOrg = localStorage.getItem('active_organization');
      if (savedOrg) {
        try {
          const orgData = JSON.parse(savedOrg);
          organizationId = orgData.id;
          console.log('Using saved organization:', organizationId);
        } catch (e) {
          console.error('Error parsing saved organization:', e);
        }
      }
      
      // If no saved org, get the first organization membership
      if (!organizationId) {
        const { data: orgMembers, error: orgError } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1);

        console.log('Organization member data:', orgMembers, 'error:', orgError);

        if (!orgMembers || orgMembers.length === 0) {
          console.log('❌ No organization found for user');
          return [];
        }

        organizationId = orgMembers[0].organization_id;
      }

      console.log('✅ Organization ID:', organizationId);

      // Build base query
      let query = supabase
        .from("contacts")
        .select(`
          *,
          contact_tags(tag),
          pipeline_contacts(
            pipeline_id,
            assigned_to_user_id,
            pipelines(id, name, icon)
          )
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      // Apply search filter
      if (filters.searchTerm) {
        query = query.or(
          `name.ilike.%${filters.searchTerm}%,email.ilike.%${filters.searchTerm}%,phone.ilike.%${filters.searchTerm}%`
        );
      }

      // Apply assigned filter
      if (filters.assignedToUserId === "unassigned") {
        query = query.is("assigned_to_user_id", null);
      }
      // Specific user filtering is applied client-side to include pipeline-level assignments

      const { data, error } = await query;
      
      console.log('📊 Query result:', { 
        dataCount: data?.length, 
        error: error?.message,
        sampleData: data?.[0]
      });
      
      if (error) {
        console.error('❌ Query error:', error);
        throw error;
      }

      let filteredData = data || [];
      console.log('Initial data count:', filteredData.length);

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
      // Apply assigned-to filter for a specific user (includes pipeline-level assignments)
      if (filters.assignedToUserId !== "all" && filters.assignedToUserId !== "unassigned") {
        filteredData = filteredData.filter((contact: any) =>
          contact.assigned_to_user_id === filters.assignedToUserId ||
          contact.pipeline_contacts?.some((pc: any) => pc.assigned_to_user_id === filters.assignedToUserId)
        );
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

      // Fetch assigned user profiles for both contact-level and pipeline-level assignments
      const contactLevelUserIds = filteredData.map(c => c.assigned_to_user_id).filter(Boolean);
      const pipelineLevelUserIds = filteredData
        .flatMap(c => c.pipeline_contacts || [])
        .map((pc: any) => pc.assigned_to_user_id)
        .filter(Boolean);
      
      const assignedUserIds = [...new Set([...contactLevelUserIds, ...pipelineLevelUserIds])];
      
      if (assignedUserIds.length > 0) {
        const { data: assignedProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", assignedUserIds);

        const profileMap = new Map();
        assignedProfiles?.forEach(profile => {
          profileMap.set(profile.user_id, profile);
        });

        filteredData = filteredData.map(contact => {
          // Prefer contact-level assignment, fallback to first pipeline assignment
          let assignedUserId = contact.assigned_to_user_id;
          if (!assignedUserId && contact.pipeline_contacts?.length > 0) {
            assignedUserId = contact.pipeline_contacts[0].assigned_to_user_id;
          }
          
          return {
            ...contact,
            profiles: assignedUserId ? profileMap.get(assignedUserId) : undefined
          };
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

      console.log('✅ Final contacts to return:', filteredData.length);
      return filteredData;
    },
    enabled: !!user,
  });

  console.log('useContacts hook result:', { 
    contactsCount: contacts?.length, 
    isLoading, 
    error: error?.message,
    contactsType: typeof contacts,
    isArray: Array.isArray(contacts)
  });

  return { contacts, isLoading };
};

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { ContactFilters } from "@/pages/ContactsPage";
import { buildPhoneOrFilter } from "@/lib/phoneSearch";

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

      // SECURITY FIX: Always get organization from server-validated membership
      console.log('🔍 Fetching organization for user:', user.id);
      
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

      const organizationId = orgMembers[0].organization_id;
      console.log('✅ [SECURITY] Server-validated organization ID:', organizationId);

      // Handle flow filtering server-side for accurate results
      let contactIdsInFlow: string[] | null = null;
      let contactIdsNotInFlows: string[] | null = null;

      if (filters.flowId !== "all") {
        if (filters.flowId === "no-flows") {
          // Get all contact IDs that ARE in any flow for this org
          const { data: contactsInFlows } = await supabase
            .from("pipeline_contacts")
            .select("contact_id, contacts!inner(organization_id)")
            .eq("contacts.organization_id", organizationId);
          
          const idsInFlows = new Set(contactsInFlows?.map(pc => pc.contact_id) || []);
          
          // We'll filter out these IDs from the main query
          contactIdsNotInFlows = Array.from(idsInFlows);
          console.log('📊 Contacts in flows to exclude:', contactIdsNotInFlows.length);
        } else {
          // Get contact IDs in this specific flow
          const { data: pipelineContacts } = await supabase
            .from("pipeline_contacts")
            .select("contact_id, contacts!inner(organization_id)")
            .eq("pipeline_id", filters.flowId)
            .eq("contacts.organization_id", organizationId);
          
          contactIdsInFlow = pipelineContacts?.map(pc => pc.contact_id) || [];
          console.log('📊 Contacts in selected flow:', contactIdsInFlow.length);
          
          // If no contacts in this flow, return early
          if (contactIdsInFlow.length === 0) {
            console.log('✅ No contacts in selected flow, returning empty');
            return [];
          }
        }
      }

      // Handle assigned-to filtering server-side for accurate results
      let contactIdsAssignedToUser: string[] | null = null;

      if (filters.assignedToUserId && filters.assignedToUserId !== "all" && filters.assignedToUserId !== "unassigned") {
        // Get contacts assigned at pipeline level
        const { data: pipelineAssignments } = await supabase
          .from("pipeline_contacts")
          .select("contact_id, contacts!inner(organization_id)")
          .eq("assigned_to_user_id", filters.assignedToUserId)
          .eq("contacts.organization_id", organizationId);
        
        const pipelineLevelIds = pipelineAssignments?.map(pc => pc.contact_id) || [];
        
        // Get contacts assigned at contact level
        const { data: contactAssignments } = await supabase
          .from("contacts")
          .select("id")
          .eq("assigned_to_user_id", filters.assignedToUserId)
          .eq("organization_id", organizationId);
        
        const contactLevelIds = contactAssignments?.map(c => c.id) || [];
        
        // Combine both lists (unique IDs)
        contactIdsAssignedToUser = [...new Set([...pipelineLevelIds, ...contactLevelIds])];
        console.log('📊 Contacts assigned to user:', contactIdsAssignedToUser.length, '(pipeline:', pipelineLevelIds.length, ', contact:', contactLevelIds.length, ')');
        
        // If no contacts assigned, return early
        if (contactIdsAssignedToUser.length === 0) {
          console.log('✅ No contacts assigned to this user, returning empty');
          return [];
        }
      }

      // Build base query
      let query = supabase
        .from("contacts")
        .select(`
          contact_engagement_scores(score, engagement_level, weeks_attended_last_12, streak_weeks, last_checkin_at, volunteer_checkins_90d),
          *,
          campuses(id, name),
          contact_tags(tag),
          pipeline_contacts(
            pipeline_id,
            assigned_to_user_id,
            pipelines(id, name, icon)
          )
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      // Apply flow filter at query level
      if (contactIdsInFlow !== null) {
        query = query.in("id", contactIdsInFlow);
      }

      // Apply assigned-to filter at query level (for specific users)
      if (contactIdsAssignedToUser !== null) {
        // Intersect with flow filter if both are applied
        if (contactIdsInFlow !== null) {
          const intersection = contactIdsAssignedToUser.filter(id => contactIdsInFlow!.includes(id));
          if (intersection.length === 0) {
            console.log('✅ No contacts match both flow and assigned-to filters');
            return [];
          }
          query = query.in("id", intersection);
        } else {
          query = query.in("id", contactIdsAssignedToUser);
        }
      }

      // Apply search filter — sanitize to avoid PostgREST syntax issues with parens/commas
      if (filters.searchTerm) {
        const sanitized = filters.searchTerm.replace(/[(),]/g, '').trim();
        const phoneFilter = buildPhoneOrFilter(filters.searchTerm);
        const phonePart = phoneFilter ? `,${phoneFilter}` : '';
        query = query.or(
          `name.ilike.%${sanitized}%,email.ilike.%${sanitized}%${phonePart}`
        );
      }

      // Apply unassigned filter (contact-level only)
      if (filters.assignedToUserId === "unassigned") {
        query = query.is("assigned_to_user_id", null);
      }

      // Apply campus filter
      if (filters.campusId && filters.campusId !== "all") {
        if (filters.campusId === "no-campus") {
          query = query.is("campus_id", null);
        } else {
          query = query.eq("campus_id", filters.campusId);
        }
      }

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

      // Apply engagement level filter
      if (filters.engagementLevel && filters.engagementLevel !== "all") {
        filteredData = filteredData.filter(contact => {
          const scores = contact.contact_engagement_scores;
          const score = Array.isArray(scores) ? scores[0] : scores;
          if (filters.engagementLevel === "none") {
            return !score || !score.engagement_level;
          }
          return score?.engagement_level === filters.engagementLevel;
        });
        console.log('After engagement filter:', filteredData.length);
      }

      // Apply "no-flows" filter client-side (exclude contacts that are in flows)
      if (contactIdsNotInFlows !== null && contactIdsNotInFlows.length > 0) {
        const idsToExclude = new Set(contactIdsNotInFlows);
        filteredData = filteredData.filter(contact => !idsToExclude.has(contact.id));
        console.log('After no-flows filter:', filteredData.length);
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

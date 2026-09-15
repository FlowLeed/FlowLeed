import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { ContactFilters } from "@/pages/ContactsPage";
import { buildPhoneOrFilter } from "@/lib/phoneSearch";

const PAGE = 1000;

/** Reads every matching row instead of the first page PostgREST returns. */
const fetchAllIds = async (
  build: () => any,
  column = "contact_id"
): Promise<string[]> => {
  const ids: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build()
      .order(column, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data || []) as any[];
    ids.push(...rows.map((r) => r[column]));
    if (rows.length < PAGE) break;
  }
  return ids;
};

export const useContacts = (filters: ContactFilters) => {
  const { user } = useAuth();

  // Cached separately so switching filters doesn't re-resolve the org every time
  const { data: organizationId } = useQuery({
    queryKey: ["contacts-org-id", user?.id],
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user!.id)
        .limit(1);
      return data?.[0]?.organization_id ?? null;
    },
  });

  const { data: contacts, isLoading, error } = useQuery({
    queryKey: ["all-contacts", organizationId, filters],
    retry: false,
    enabled: !!user && !!organizationId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!user || !organizationId) return [];


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

      // Marker filter: get contact IDs that have the marker
      let contactIdsWithMarker: string[] | null = null;
      if (filters.markerKey && filters.markerKey !== "all") {
        // "signal:<id>" targets a custom signal directly
        const directSignalId = filters.markerKey.startsWith("signal:")
          ? filters.markerKey.slice("signal:".length)
          : null;
        const { data: markerSetting } = directSignalId
          ? { data: null }
          : await supabase
              .from("org_marker_settings" as any)
              .select("promoted_signal_id")
              .eq("organization_id", organizationId)
              .eq("marker_key", filters.markerKey)
              .maybeSingle();
        const promotedSignalId =
          directSignalId ?? ((markerSetting as any)?.promoted_signal_id as string | undefined);
        contactIdsWithMarker = promotedSignalId
          ? await fetchAllIds(() =>
              supabase
                .from("custom_signal_contacts" as any)
                .select("contact_id")
                .eq("organization_id", organizationId)
                .eq("signal_id", promotedSignalId)
                .is("cleared_at", null)
            )
          : await fetchAllIds(() =>
              supabase
                .from("contact_markers")
                .select("contact_id")
                .eq("organization_id", organizationId)
                .eq("marker_key", filters.markerKey)
            );
        if (contactIdsWithMarker.length === 0) {
          return [];
        }
      }

      // Combine all id-restricting filters into one list so we can chunk requests
      const idLists = [contactIdsInFlow, contactIdsWithMarker, contactIdsAssignedToUser].filter(
        (l): l is string[] => l !== null
      );
      let restrictIds: string[] | null = null;
      if (idLists.length > 0) {
        restrictIds = idLists.reduce((acc, list) => {
          const set = new Set(list);
          return acc.filter((id) => set.has(id));
        }, [...new Set(idLists[0])]);
        if (restrictIds.length === 0) return [];
      }

      const buildQuery = (idsChunk: string[] | null) => {
        let query = supabase
          .from("contacts")
          .select(`
            contact_engagement_scores(score, engagement_level, signal, weeks_attended_last_12, streak_weeks, last_checkin_at, volunteer_checkins_90d),
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

        if (idsChunk) query = query.in("id", idsChunk);

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

        return query;
      };

      // A long list of ids makes the request URL too large, so read it in chunks
      const ID_CHUNK = 150;
      const rows: any[] = [];
      if (restrictIds === null) {
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await buildQuery(null).range(from, from + PAGE - 1);
          if (error) {
            console.error('❌ Query error:', error);
            throw error;
          }
          const page = data || [];
          rows.push(...page);
          if (page.length < PAGE) break;
        }
      } else {
        const chunks: string[][] = [];
        for (let i = 0; i < restrictIds.length; i += ID_CHUNK) {
          chunks.push(restrictIds.slice(i, i + ID_CHUNK));
        }
        // Run a few chunks at a time so large signals load quickly
        const CONCURRENCY = 4;
        for (let i = 0; i < chunks.length; i += CONCURRENCY) {
          const results = await Promise.all(
            chunks.slice(i, i + CONCURRENCY).map((chunk) => buildQuery(chunk))
          );
          for (const { data, error } of results as any[]) {
            if (error) {
              console.error('❌ Query error:', error);
              throw error;
            }
            rows.push(...(data || []));
          }
        }
      }

      let filteredData = rows;
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

      // Apply signal filter
      if (filters.signal && filters.signal !== "all") {
        filteredData = filteredData.filter(contact => {
          const scores = contact.contact_engagement_scores;
          const score = Array.isArray(scores) ? scores[0] : scores;
          if (filters.signal === "none") return !score?.signal;
          return score?.signal === filters.signal;
        });
      }

      // Apply tag filter
      if (filters.tag && filters.tag !== "all") {
        filteredData = filteredData.filter(contact => {
          const tags = contact.contact_tags || [];
          return tags.some((t: any) => t.tag === filters.tag);
        });
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


      console.log('✅ Final contacts to return:', filteredData.length);
      return filteredData;
    },
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

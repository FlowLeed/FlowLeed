import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// PHASE 2: Consolidated dashboard data hook - fetches all dashboard data in parallel
export const useDashboardData = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["dashboard-all", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");

      console.log('[useDashboardData] Fetching all dashboard data for user:', userId);

      // Fetch all dashboard data in parallel
      const [
        myContactsResult,
        myInteractionsResult,
        pendingTasksResult,
        myContactsDataResult,
        upcomingTasksResult,
        activityFeedResult
      ] = await Promise.all([
        // My contacts count
        supabase
          .from("pipeline_contacts")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to_user_id", userId),

        // My interactions this month
        supabase
          .from("contact_interactions")
          .select("*", { count: "exact", head: true })
          .eq("created_by_user_id", userId)
          .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),

        // Pending tasks
        supabase
          .from("contact_interactions")
          .select("*", { count: "exact", head: true })
          .or(`assigned_to_user_id.eq.${userId},created_by_user_id.eq.${userId}`)
          .not("scheduled_at", "is", null)
          .is("completed_at", null)
          .gte("scheduled_at", new Date().toISOString()),

        // Contacts needing attention - get my contacts first
        supabase
          .from("pipeline_contacts")
          .select("contact_id")
          .eq("assigned_to_user_id", userId),

        // Upcoming tasks with details
        supabase
          .from("contact_interactions")
          .select(`
            id,
            subject,
            scheduled_at,
            contacts (
              id,
              name,
              avatar
            )
          `)
          .or(`assigned_to_user_id.eq.${userId},created_by_user_id.eq.${userId}`)
          .not("scheduled_at", "is", null)
          .is("completed_at", null)
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at")
          .limit(5),

        // Team activity feed
        supabase
          .from("contact_interactions")
          .select(`
            id,
            interaction_type,
            subject,
            created_at,
            contacts (
              id,
              name
            ),
            profiles!contact_interactions_created_by_user_id_fkey (
              full_name,
              email,
              avatar_url
            ),
            pipelines (
              name
            )
          `)
          .order("created_at", { ascending: false })
          .limit(10)
      ]);

      // Calculate contacts needing attention
      let needingAttentionCount = 0;
      if (myContactsDataResult.data && myContactsDataResult.data.length > 0) {
        const contactIds = myContactsDataResult.data.map((c) => c.contact_id);
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const { data: recentInteractions } = await supabase
          .from("contact_interactions")
          .select("contact_id")
          .in("contact_id", contactIds)
          .gte("created_at", fourteenDaysAgo.toISOString());

        const contactsWithRecentInteraction = new Set(
          recentInteractions?.map((i) => i.contact_id) || []
        );
        needingAttentionCount = contactIds.filter(
          (id) => !contactsWithRecentInteraction.has(id)
        ).length;
      }

      // Format contacts needing attention
      let contactsNeedingAttention: any[] = [];
      if (needingAttentionCount > 0 && myContactsDataResult.data) {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const contactIds = myContactsDataResult.data.map((c) => c.contact_id);
        const { data: recentInteractions } = await supabase
          .from("contact_interactions")
          .select("contact_id, created_at")
          .in("contact_id", contactIds)
          .gte("created_at", fourteenDaysAgo.toISOString())
          .order("created_at", { ascending: false });

        const interactionMap = new Map();
        recentInteractions?.forEach((i) => {
          if (!interactionMap.has(i.contact_id)) {
            interactionMap.set(i.contact_id, i.created_at);
          }
        });

        const { data: contactsData } = await supabase
          .from("contacts")
          .select(`
            id,
            name,
            avatar,
            pipeline_contacts!inner (
              pipeline_id,
              pipelines (
                name
              )
            )
          `)
          .in("id", contactIds)
          .limit(5);

        contactsNeedingAttention = contactsData?.map((contact) => {
          const lastContact = interactionMap.get(contact.id);
          const daysSince = lastContact
            ? Math.floor((Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24))
            : 14;

          return {
            id: contact.id,
            name: contact.name,
            avatar: contact.avatar,
            daysSinceLastContact: daysSince,
            flow: contact.pipeline_contacts?.[0]?.pipelines?.name
          };
        }) || [];
      }

      // Format upcoming tasks
      const upcomingTasks = upcomingTasksResult.data?.map((task: any) => ({
        id: task.id,
        subject: task.subject,
        scheduled_at: task.scheduled_at,
        scheduledAt: task.scheduled_at,
        contacts: task.contacts,
        contact: {
          id: task.contacts?.id,
          name: task.contacts?.name,
          avatar: task.contacts?.avatar
        }
      })) || [];

      // Format activity feed
      const activityFeed = activityFeedResult.data?.map((activity: any) => ({
        id: activity.id,
        interaction_type: activity.interaction_type,
        subject: activity.subject,
        created_at: activity.created_at,
        metadata: {},
        profiles: activity.profiles,
        contacts: activity.contacts,
        user: {
          name: activity.profiles?.full_name || activity.profiles?.email || "Unknown",
          avatar: activity.profiles?.avatar_url
        },
        contact: {
          name: activity.contacts?.name
        },
        flow: {
          name: activity.pipelines?.name
        }
      })) || [];

      return {
        metrics: {
          myContacts: myContactsResult.count || 0,
          myInteractions: myInteractionsResult.count || 0,
          pendingTasks: pendingTasksResult.count || 0,
          peopleNeedingAttention: needingAttentionCount
        },
        contactsNeedingAttention,
        upcomingTasks,
        activityFeed
      };
    },
    enabled: !!userId,
    refetchOnMount: true,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

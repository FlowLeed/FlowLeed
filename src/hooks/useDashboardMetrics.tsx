import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDashboardMetrics = (userId: string | undefined) => {
  console.log('[useDashboardMetrics] Called with userId:', userId);
  
  return useQuery({
    queryKey: ["dashboard-metrics", userId],
    queryFn: async () => {
      if (!userId) {
        console.error('[useDashboardMetrics] No userId provided');
        throw new Error("User ID is required");
      }

      console.log('[useDashboardMetrics] Fetching metrics for user:', userId);
      
      // Get my contacts count (assigned to me)
      const { count: myContactsCount, error: contactsError } = await supabase
        .from("pipeline_contacts")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to_user_id", userId);

      if (contactsError) {
        console.error('[useDashboardMetrics] Error fetching contacts:', contactsError);
      }
      console.log('[useDashboardMetrics] My contacts count:', myContactsCount);

      // Get my interactions this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: myInteractionsCount, error: interactionsError } = await supabase
        .from("contact_interactions")
        .select("*", { count: "exact", head: true })
        .eq("created_by_user_id", userId)
        .gte("created_at", startOfMonth.toISOString());

      if (interactionsError) {
        console.error('[useDashboardMetrics] Error fetching interactions:', interactionsError);
      }
      console.log('[useDashboardMetrics] My interactions count:', myInteractionsCount);

      // Get pending tasks (scheduled but not completed)
      const { count: pendingTasksCount, error: tasksError } = await supabase
        .from("contact_interactions")
        .select("*", { count: "exact", head: true })
        .or(`assigned_to_user_id.eq.${userId},created_by_user_id.eq.${userId}`)
        .not("scheduled_at", "is", null)
        .is("completed_at", null)
        .gte("scheduled_at", new Date().toISOString());

      if (tasksError) {
        console.error('[useDashboardMetrics] Error fetching tasks:', tasksError);
      }
      console.log('[useDashboardMetrics] Pending tasks count:', pendingTasksCount);

      // Get people needing attention (no interaction in 14+ days)
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data: myContacts } = await supabase
        .from("pipeline_contacts")
        .select("contact_id")
        .eq("assigned_to_user_id", userId);

      const contactIds = myContacts?.map((c) => c.contact_id) || [];

      let needingAttentionCount = 0;
      if (contactIds.length > 0) {
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

      const result = {
        myContacts: myContactsCount || 0,
        myInteractions: myInteractionsCount || 0,
        pendingTasks: pendingTasksCount || 0,
        peopleNeedingAttention: needingAttentionCount,
      };
      
      console.log('[useDashboardMetrics] Final result:', result);
      return result;
    },
    enabled: !!userId,
    refetchOnMount: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

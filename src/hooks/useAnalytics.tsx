import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export type DateRangePreset = "today" | "week" | "month" | "year" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export const getDateRangeFromPreset = (preset: DateRangePreset): DateRange => {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "week":
      return { from: startOfWeek(now), to: endOfWeek(now) };
    case "month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "year":
      return { from: startOfYear(now), to: endOfYear(now) };
    default:
      return { from: startOfYear(now), to: endOfYear(now) };
  }
};

export const useOverviewMetrics = (dateRange: DateRange, campusId?: string | null) => {
  return useQuery({
    queryKey: ["overview-metrics", dateRange, campusId],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("User not authenticated");

      // SECURITY FIX: Always get organization from server-validated membership
      const { data: orgMembers } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1);

      if (!orgMembers || orgMembers.length === 0) {
        throw new Error("Organization not found");
      }

      const organizationId = orgMembers[0].organization_id;

      // Total contacts
      const { count: totalContacts } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId);

      // Contacts added in range
      const { count: contactsAdded } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      // Active flows (pipelines with at least one contact)
      const { data: activeFlows } = await supabase
        .from("pipelines")
        .select("id, pipeline_contacts(count)")
        .eq("organization_id", organizationId);

      const activeFlowCount = activeFlows?.filter(f => f.pipeline_contacts.length > 0).length || 0;

      // Total interactions in range
      const { count: totalInteractions } = await supabase
        .from("contact_interactions")
        .select("*, contacts!inner(organization_id)", { count: "exact", head: true })
        .eq("contacts.organization_id", organizationId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      // Active team members (distinct users with interactions in range)
      const { data: activeMembers } = await supabase
        .from("contact_interactions")
        .select("created_by_user_id, contacts!inner(organization_id)")
        .eq("contacts.organization_id", organizationId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      const activeTeamMembers = new Set(activeMembers?.map(m => m.created_by_user_id)).size;

      return {
        totalContacts: totalContacts || 0,
        contactsAdded: contactsAdded || 0,
        activeFlows: activeFlowCount,
        totalInteractions: totalInteractions || 0,
        activeTeamMembers,
      };
    },
  });
};

export const useFlowAnalytics = () => {
  return useQuery({
    queryKey: ["flow-analytics"],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("User not authenticated");

      // SECURITY FIX: Always get organization from server-validated membership
      const { data: orgMembers } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1);

      if (!orgMembers || orgMembers.length === 0) {
        throw new Error("Organization not found");
      }

      const organizationId = orgMembers[0].organization_id;

      const { data: flows } = await supabase
        .from("pipelines")
        .select(`
          id,
          name,
          icon,
          pipeline_contacts(count),
          pipeline_stages(id, name, is_start_step, is_end_step)
        `)
        .eq("organization_id", organizationId);

      const flowAnalytics = await Promise.all(
        (flows || []).map(async (flow) => {
          const startStage = flow.pipeline_stages.find(s => s.is_start_step);
          const endStage = flow.pipeline_stages.find(s => s.is_end_step);

          let startCount = 0;
          let endCount = 0;
          let avgTimeInFlow = null;

          if (startStage) {
            const { count } = await supabase
              .from("pipeline_contacts")
              .select("*", { count: "exact", head: true })
              .eq("pipeline_id", flow.id)
              .eq("stage_id", startStage.id);
            startCount = count || 0;
          }

          if (endStage) {
            const { count } = await supabase
              .from("pipeline_contacts")
              .select("*", { count: "exact", head: true })
              .eq("pipeline_id", flow.id)
              .eq("stage_id", endStage.id);
            endCount = count || 0;

            // Calculate average time in flow
            const { data: completedContacts } = await supabase
              .from("pipeline_contacts")
              .select("entered_start_at, completed_end_at")
              .eq("pipeline_id", flow.id)
              .not("entered_start_at", "is", null)
              .not("completed_end_at", "is", null);

            if (completedContacts && completedContacts.length > 0) {
              const totalDays = completedContacts.reduce((sum, contact) => {
                const start = new Date(contact.entered_start_at!);
                const end = new Date(contact.completed_end_at!);
                const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
                return sum + days;
              }, 0);
              avgTimeInFlow = totalDays / completedContacts.length;
            }
          }

          const conversionRate = startCount > 0 ? (endCount / startCount) * 100 : 0;

          return {
            id: flow.id,
            name: flow.name,
            icon: flow.icon,
            totalContacts: (flow.pipeline_contacts as any)[0]?.count || 0,
            startCount,
            endCount,
            conversionRate,
            avgTimeInFlow,
          };
        })
      );

      return flowAnalytics;
    },
  });
};

export const useTeamPerformance = (dateRange: DateRange) => {
  return useQuery({
    queryKey: ["team-performance", dateRange],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("User not authenticated");

      // SECURITY FIX: Always get organization from server-validated membership
      const { data: orgMembers } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1);

      if (!orgMembers || orgMembers.length === 0) {
        throw new Error("Organization not found");
      }

      const organizationId = orgMembers[0].organization_id;

      // Get all team members
      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId);

      // Get profiles separately
      const userIds = members?.map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const teamPerformance = await Promise.all(
        (members || []).map(async (member) => {
          const profile = profileMap.get(member.user_id);
          
          // Count assigned contacts
          const { count: assignedContacts } = await supabase
            .from("pipeline_contacts")
            .select("*, pipelines!inner(organization_id)", { count: "exact", head: true })
            .eq("pipelines.organization_id", organizationId)
            .eq("assigned_to_user_id", member.user_id);

          // Count interactions in date range
          const { data: interactions } = await supabase
            .from("contact_interactions")
            .select("interaction_type, contacts!inner(organization_id)")
            .eq("contacts.organization_id", organizationId)
            .eq("created_by_user_id", member.user_id)
            .gte("created_at", dateRange.from.toISOString())
            .lte("created_at", dateRange.to.toISOString());

          // Group by interaction type
          const interactionTypes: Record<string, number> = {};
          interactions?.forEach((i) => {
            interactionTypes[i.interaction_type] = (interactionTypes[i.interaction_type] || 0) + 1;
          });

          return {
            userId: member.user_id,
            name: profile?.full_name || "Unknown",
            avatarUrl: profile?.avatar_url,
            assignedContacts: assignedContacts || 0,
            totalInteractions: interactions?.length || 0,
            interactionTypes,
          };
        })
      );

      return teamPerformance.sort((a, b) => b.totalInteractions - a.totalInteractions);
    },
  });
};

export const useAtRiskContacts = (daysInactive: number = 30) => {
  return useQuery({
    queryKey: ["at-risk-contacts", daysInactive],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("User not authenticated");

      // SECURITY FIX: Always get organization from server-validated membership
      const { data: orgMembers } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1);

      if (!orgMembers || orgMembers.length === 0) {
        throw new Error("Organization not found");
      }

      const organizationId = orgMembers[0].organization_id;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

      // Get all contacts
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, email, avatar")
        .eq("organization_id", organizationId);

      const atRiskContacts = await Promise.all(
        (contacts || []).map(async (contact) => {
          // Get last interaction
          const { data: lastInteraction } = await supabase
            .from("contact_interactions")
            .select("created_at")
            .eq("contact_id", contact.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          // Get flow memberships
          const { data: flows } = await supabase
            .from("pipeline_contacts")
            .select("pipelines(id, name)")
            .eq("contact_id", contact.id);

          const lastInteractionDate = lastInteraction?.created_at
            ? new Date(lastInteraction.created_at)
            : null;

          const daysSinceLastContact = lastInteractionDate
            ? Math.floor((new Date().getTime() - lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24))
            : null;

          // Only include if no interaction or last interaction was before cutoff
          if (!lastInteractionDate || lastInteractionDate < cutoffDate) {
            return {
              ...contact,
              lastInteractionDate,
              daysSinceLastContact,
              flows: flows?.map(f => f.pipelines).filter(Boolean) || [],
            };
          }
          return null;
        })
      );

      return atRiskContacts
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .sort((a, b) => (b.daysSinceLastContact || 0) - (a.daysSinceLastContact || 0));
    },
  });
};

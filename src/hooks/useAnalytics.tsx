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
      let totalContactsQuery = supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId);
      if (campusId) totalContactsQuery = totalContactsQuery.eq("campus_id", campusId);
      const { count: totalContacts } = await totalContactsQuery;

      // Contacts added in range
      let contactsAddedQuery = supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());
      if (campusId) contactsAddedQuery = contactsAddedQuery.eq("campus_id", campusId);
      const { count: contactsAdded } = await contactsAddedQuery;

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

      const { data: orgMembers } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1);

      if (!orgMembers || orgMembers.length === 0) {
        throw new Error("Organization not found");
      }

      const organizationId = orgMembers[0].organization_id;
      const STALLED_DAYS = 30;
      const stalledCutoff = new Date();
      stalledCutoff.setDate(stalledCutoff.getDate() - STALLED_DAYS);

      const { data: flows } = await supabase
        .from("pipelines")
        .select(`
          id,
          name,
          icon,
          pipeline_stages(id, name, is_start_step, is_end_step)
        `)
        .eq("organization_id", organizationId);

      const flowIds = (flows || []).map((f) => f.id);

      const { data: allPc } = await supabase
        .from("pipeline_contacts")
        .select("pipeline_id, stage_id, contact_id, entered_start_at, completed_end_at, stage_entered_at")
        .in("pipeline_id", flowIds.length > 0 ? flowIds : ["00000000-0000-0000-0000-000000000000"]);

      const contactIds = Array.from(new Set((allPc || []).map((p) => p.contact_id)));
      const scoreMap = new Map<string, number>();
      if (contactIds.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < contactIds.length; i += chunkSize) {
          const chunk = contactIds.slice(i, i + chunkSize);
          const { data: scores } = await supabase
            .from("contact_engagement_scores")
            .select("contact_id, score")
            .in("contact_id", chunk);
          (scores || []).forEach((s) => scoreMap.set(s.contact_id, s.score ?? 0));
        }
      }

      const flowAnalytics = (flows || []).map((flow) => {
        const startStage = flow.pipeline_stages.find((s) => s.is_start_step);
        const endStage = flow.pipeline_stages.find((s) => s.is_end_step);
        const pcs = (allPc || []).filter((p) => p.pipeline_id === flow.id);

        const totalContacts = pcs.length;
        const startCount = startStage ? pcs.filter((p) => p.stage_id === startStage.id).length : 0;
        const endCount = endStage ? pcs.filter((p) => p.stage_id === endStage.id).length : 0;
        const activePeople = endStage
          ? pcs.filter((p) => p.stage_id !== endStage.id).length
          : totalContacts;

        const peopleStalled = pcs.filter((p) => {
          if (endStage && p.stage_id === endStage.id) return false;
          const entered = p.stage_entered_at ? new Date(p.stage_entered_at) : null;
          return entered ? entered < stalledCutoff : false;
        }).length;

        const completed = pcs.filter((p) => p.entered_start_at && p.completed_end_at);
        let avgTimeInFlow: number | null = null;
        if (completed.length > 0) {
          const totalDays = completed.reduce((sum, c) => {
            const s = new Date(c.entered_start_at!).getTime();
            const e = new Date(c.completed_end_at!).getTime();
            return sum + (e - s) / (1000 * 60 * 60 * 24);
          }, 0);
          avgTimeInFlow = totalDays / completed.length;
        }

        const conversionRate = startCount > 0 ? (endCount / startCount) * 100 : 0;
        const completionRate = totalContacts > 0 ? (endCount / totalContacts) * 100 : 0;

        const startScores = startStage
          ? pcs
              .filter((p) => p.stage_id === startStage.id)
              .map((p) => scoreMap.get(p.contact_id))
              .filter((s): s is number => typeof s === "number")
          : [];
        const completedScores = endStage
          ? pcs
              .filter((p) => p.stage_id === endStage.id)
              .map((p) => scoreMap.get(p.contact_id))
              .filter((s): s is number => typeof s === "number")
          : [];
        const avg = (arr: number[]) =>
          arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        const startAvg = avg(startScores);
        const completedAvg = avg(completedScores);
        const engagementLift =
          startAvg !== null && completedAvg !== null ? completedAvg - startAvg : null;

        return {
          id: flow.id,
          name: flow.name,
          icon: flow.icon,
          totalContacts,
          startCount,
          endCount,
          activePeople,
          peopleStalled,
          conversionRate,
          completionRate,
          avgTimeInFlow,
          engagementLift,
          entryAvgScore: startAvg,
          completedAvgScore: completedAvg,
        };
      });

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

      // Fetch team activity stats (last_active, active_days_30d) server-side
      const { data: activityStats } = await supabase.rpc(
        "get_org_team_activity_stats",
        { p_org_id: organizationId }
      );
      const activityMap = new Map(
        (activityStats || []).map((a: any) => [a.user_id, a])
      );

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

          const stat: any = activityMap.get(member.user_id);
          const lastActiveRaw = stat?.last_active_at as string | undefined;
          const lastActiveAt =
            lastActiveRaw && new Date(lastActiveRaw).getFullYear() > 1970
              ? lastActiveRaw
              : null;

          return {
            userId: member.user_id,
            name: profile?.full_name || "Unknown",
            avatarUrl: profile?.avatar_url,
            assignedContacts: assignedContacts || 0,
            totalInteractions: interactions?.length || 0,
            interactionTypes,
            lastActiveAt,
            activeDays30d: stat?.active_days_30d ?? 0,
          };
        })
      );

      return teamPerformance.sort((a, b) => b.totalInteractions - a.totalInteractions);
    },
  });
};

export const useAtRiskContacts = (daysInactive: number = 30, campusId?: string | null) => {
  return useQuery({
    queryKey: ["at-risk-contacts", daysInactive, campusId],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("User not authenticated");

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

      // Get all contacts (optionally filtered by campus)
      let contactsQuery = supabase
        .from("contacts")
        .select("id, name, email, avatar, campus_id")
        .eq("organization_id", organizationId);
      if (campusId) contactsQuery = contactsQuery.eq("campus_id", campusId);
      const { data: contacts } = await contactsQuery;

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

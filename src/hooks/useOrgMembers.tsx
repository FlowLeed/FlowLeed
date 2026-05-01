import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrgMember {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

export const useOrgMembers = (userId: string | undefined, enabled: boolean) => {
  return useQuery({
    queryKey: ["org-members-list", userId],
    queryFn: async (): Promise<OrgMember[]> => {
      if (!userId) return [];

      // Find current user's organization
      const { data: myMembership, error: meErr } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (meErr) throw meErr;
      if (!myMembership?.organization_id) return [];

      const { data: members, error: memErr } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", myMembership.organization_id);
      if (memErr) throw memErr;
      if (!members || members.length === 0) return [];

      const userIds = members.map((m: any) => m.user_id).filter(Boolean);
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);
      if (profErr) throw profErr;

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      return members
        .map((m: any) => {
          const p = profileMap.get(m.user_id);
          return {
            user_id: m.user_id,
            full_name: p?.full_name || "Unnamed",
            avatar_url: p?.avatar_url ?? null,
          };
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: !!userId && enabled,
    staleTime: 5 * 60 * 1000,
  });
};

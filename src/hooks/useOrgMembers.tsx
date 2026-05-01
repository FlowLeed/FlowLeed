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
        .select("user_id, profiles:user_id(full_name, avatar_url)")
        .eq("organization_id", myMembership.organization_id);
      if (memErr) throw memErr;

      return (members || [])
        .map((m: any) => ({
          user_id: m.user_id,
          full_name: m.profiles?.full_name || "Unnamed",
          avatar_url: m.profiles?.avatar_url ?? null,
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: !!userId && enabled,
    staleTime: 5 * 60 * 1000,
  });
};

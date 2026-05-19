import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrgMemberActivity {
  user_id: string;
  role: string;
  joined_at: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  last_login: string | null;
  logins_30d: number;
  logins_7d: number;
  contacts_assigned: number;
  notes_30d: number;
  interactions_30d: number;
}

export function useOrgMembersActivity(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-members-activity', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<OrgMemberActivity[]> => {
      const { data, error } = await supabase.rpc('admin_get_org_members_activity', {
        p_org_id: orgId!,
      });
      if (error) throw error;
      return (data ?? []) as OrgMemberActivity[];
    },
  });
}

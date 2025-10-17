import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  admin_name: string | null;
  admin_email: string | null;
  admin_user_id: string | null;
  plan_tier: string | null;
  subscription_status: string | null;
  created_at: string;
  last_login: string | null;
  total_logins_30d: number | null;
  last_pco_sync: string | null;
  flows_count: number | null;
  active_users: number | null;
  contacts_count: number | null;
  avg_weekly_activity: number | null;
  ai_uses_30d: number | null;
  health_score: number | null;
}

export const useOrganizationsData = () => {
  return useQuery({
    queryKey: ['admin-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_organizations_health_data' as any);

      if (error) throw error;
      return (data || []) as OrganizationData[];
    },
  });
};

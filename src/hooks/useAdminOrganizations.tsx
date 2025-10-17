import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  subscription_status: string;
  plan_tier: string;
  health_score: number;
  admin_user_id: string;
  admin_name: string;
  admin_email: string;
  total_logins_30d: number;
  last_login: string | null;
  flows_count: number;
  contacts_count: number;
  active_users: number;
  last_pco_sync: string | null;
  ai_uses_30d: number;
  avg_weekly_activity: number;
}

interface UseAdminOrganizationsOptions {
  search?: string;
  statusFilter?: string;
  planFilter?: string;
  healthScoreMin?: number;
  healthScoreMax?: number;
}

export const useAdminOrganizations = (options: UseAdminOrganizationsOptions = {}) => {
  return useQuery({
    queryKey: ['admin-organizations', options],
    queryFn: async () => {
      let query = supabase
        .from('organization_health_view')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (options.search) {
        query = query.or(
          `name.ilike.%${options.search}%,admin_name.ilike.%${options.search}%,admin_email.ilike.%${options.search}%`
        );
      }

      if (options.statusFilter && options.statusFilter !== 'all') {
        query = query.eq('subscription_status', options.statusFilter);
      }

      if (options.planFilter && options.planFilter !== 'all') {
        query = query.eq('plan_tier', options.planFilter);
      }

      if (options.healthScoreMin !== undefined) {
        query = query.gte('health_score', options.healthScoreMin);
      }

      if (options.healthScoreMax !== undefined) {
        query = query.lte('health_score', options.healthScoreMax);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []) as AdminOrganization[];
    },
  });
};

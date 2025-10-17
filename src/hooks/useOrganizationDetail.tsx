import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useOrganizationDetail = (orgId: string) => {
  return useQuery({
    queryKey: ['organization-detail', orgId],
    queryFn: async () => {
      // Fetch organization data
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (orgError) throw orgError;

      // Fetch team members
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('organization_id', orgId);

      if (membersError) throw membersError;

      // Fetch pipelines (flows)
      const { data: pipelines, error: pipelinesError } = await supabase
        .from('pipelines')
        .select(`
          id,
          name,
          description,
          icon,
          created_at,
          pipeline_contacts (count)
        `)
        .eq('organization_id', orgId);

      if (pipelinesError) throw pipelinesError;

      // Fetch integrations
      const { data: integrations, error: integrationsError } = await supabase
        .from('integrations')
        .select('*')
        .eq('organization_id', orgId);

      if (integrationsError) throw integrationsError;

      // Fetch activity stats (last 30 days)
      const { data: activityStats, error: statsError } = await supabase
        .from('organization_activity_stats')
        .select('*')
        .eq('organization_id', orgId)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('date', { ascending: false });

      if (statsError) throw statsError;

      return {
        organization: org,
        members: members || [],
        pipelines: pipelines || [],
        integrations: integrations || [],
        activityStats: activityStats || [],
      };
    },
    enabled: !!orgId,
  });
};

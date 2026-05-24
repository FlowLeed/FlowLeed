import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  use_twilio_integration: boolean;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface OrganizationMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
  organizations: Organization;
}

const SELECTED_ORG_KEY = 'selectedOrganizationId';

export const useProfile = () => {
  const { user } = useAuth();
  const userId = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['profile-organization', userId],
    queryFn: async () => {
      if (!userId) return { profile: null, organization: null };

      const [profileResult, membershipsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('organization_members')
          .select(`
            id,
            organization_id,
            user_id,
            role,
            created_at,
            organizations (
              id,
              name,
              slug
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
      ]);

      if (profileResult.error) {
        console.error('[useProfile] Error fetching profile:', profileResult.error);
      }

      if (membershipsResult.error) {
        console.error('Error fetching organizations:', membershipsResult.error);
        return { profile: profileResult.data as Profile | null, organization: null };
      }

      const memberships = membershipsResult.data || [];
      if (memberships.length === 0) {
        console.error('No organization memberships found for user');
        return { profile: profileResult.data as Profile | null, organization: null };
      }

      const savedOrgId = localStorage.getItem(SELECTED_ORG_KEY);
      const savedMembership = savedOrgId
        ? memberships.find((m) => m.organization_id === savedOrgId)
        : undefined;

      if (savedOrgId && !savedMembership) {
        console.warn('[SECURITY] Saved org not in user memberships, ignoring localStorage');
        localStorage.removeItem(SELECTED_ORG_KEY);
      }

      const selectedMembership = savedMembership || [...memberships].sort((a, b) => {
        const rolePriority = { owner: 0, admin: 1, member: 2 };
        const roleA = rolePriority[a.role as keyof typeof rolePriority] ?? 999;
        const roleB = rolePriority[b.role as keyof typeof rolePriority] ?? 999;
        if (roleA !== roleB) return roleA - roleB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })[0];

      const organization = selectedMembership.organizations as Organization;
      localStorage.setItem(SELECTED_ORG_KEY, organization.id);

      return { profile: profileResult.data as Profile | null, organization };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return useMemo(() => ({
    profile: data?.profile || null,
    organization: data?.organization || null,
    loading: !!userId && isLoading,
  }), [data, isLoading, userId]);
};
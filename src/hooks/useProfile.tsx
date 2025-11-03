import { useState, useEffect } from 'react';
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setOrganization(null);
      setLoading(false);
      return;
    }

    const fetchProfileAndOrganization = async () => {
      try {
        console.log('[useProfile] Fetching profile for user:', user.id);
        
        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('[useProfile] Error fetching profile:', profileError);
        } else {
          setProfile(profileData);
        }

        // Fetch ALL user's organizations - SECURITY: Always validate from server
        const { data: memberships, error: orgError } = await supabase
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
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (orgError) {
          console.error('Error fetching organizations:', orgError);
        } else if (memberships && memberships.length > 0) {
          // SECURITY FIX: localStorage is only used as a preference hint, not as source of truth
          // We ALWAYS validate the user is actually a member of the organization
          const savedOrgId = localStorage.getItem(SELECTED_ORG_KEY);
          
          let selectedOrg: Organization | null = null;
          
          // Check if saved org exists in user's ACTUAL memberships (server-validated)
          if (savedOrgId) {
            const savedMembership = memberships.find(m => m.organization_id === savedOrgId);
            if (savedMembership) {
              selectedOrg = savedMembership.organizations as Organization;
              console.log('[SECURITY] Validated saved organization:', selectedOrg.id);
            } else {
              console.warn('[SECURITY] Saved org not in user memberships, ignoring localStorage');
              localStorage.removeItem(SELECTED_ORG_KEY);
            }
          }
          
          // If no valid saved org, pick default deterministically
          if (!selectedOrg) {
            // Sort by role priority (owner > admin > member) then by created_at
            const rolePriority = { owner: 0, admin: 1, member: 2 };
            const sortedMemberships = [...memberships].sort((a, b) => {
              const roleA = rolePriority[a.role as keyof typeof rolePriority] ?? 999;
              const roleB = rolePriority[b.role as keyof typeof rolePriority] ?? 999;
              if (roleA !== roleB) return roleA - roleB;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
            
            selectedOrg = sortedMemberships[0].organizations as Organization;
            console.log('[SECURITY] Selected default organization:', selectedOrg.id, 'role:', sortedMemberships[0].role);
          }
          
          if (selectedOrg) {
            // Store preference (but this will always be validated on next load)
            localStorage.setItem(SELECTED_ORG_KEY, selectedOrg.id);
            setOrganization(selectedOrg);
            console.log('[SECURITY] Organization loaded and validated:', selectedOrg.id);
          }
        } else {
          console.error('No organization memberships found for user');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndOrganization();
  }, [user]);

  return { profile, organization, loading };
};
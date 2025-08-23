import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

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
        console.log("useProfile - Fetching data for user ID:", user.id);
        
        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log("useProfile - Profile fetch result:", { profileData, profileError });

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        } else {
          setProfile(profileData);
        }

        // Fetch user's organization
        console.log("useProfile - Fetching organization for user ID:", user.id);
        const { data: orgData, error: orgError } = await supabase
          .from('organization_members')
          .select(`
            organizations (
              id,
              name,
              slug
            )
          `)
          .eq('user_id', user.id)
          .maybeSingle();

        console.log("useProfile - Organization fetch result:", { orgData, orgError });

        if (orgError) {
          console.error('Error fetching organization:', orgError);
        } else if (orgData) {
          console.log("useProfile - Setting organization:", orgData.organizations);
          setOrganization(orgData.organizations as Organization);
        } else {
          console.log("useProfile - No organization data found for user");
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
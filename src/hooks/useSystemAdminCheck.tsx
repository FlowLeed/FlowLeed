import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type SystemRole = 'super_admin' | 'support_admin' | null;

interface SystemAdminCheck {
  isAdmin: boolean;
  loading: boolean;
  role: SystemRole;
}

export const useSystemAdminCheck = (): SystemAdminCheck => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<SystemRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        // Call is_system_admin function
        const { data: isAdminData, error: isAdminError } = await supabase
          .rpc('is_system_admin' as any, {
            _user_id: user.id
          });

        if (isAdminError) {
          console.error('Error checking admin status:', isAdminError);
          setIsAdmin(false);
          setRole(null);
        } else if (isAdminData === true) {
          setIsAdmin(true);
          
          // Get the specific role
          const { data: roleData, error: roleError } = await supabase
            .rpc('get_user_system_role' as any, { _user_id: user.id });
          
          if (!roleError && roleData) {
            setRole(roleData as SystemRole);
          } else {
            setRole('super_admin'); // Default fallback
          }
        } else {
          setIsAdmin(false);
          setRole(null);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  return { isAdmin, loading, role };
};

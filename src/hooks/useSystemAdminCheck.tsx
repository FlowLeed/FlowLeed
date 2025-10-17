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
        const { data, error } = await supabase.rpc('is_system_admin', {
          _user_id: user.id
        });

        if (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
          setRole(null);
        } else {
          setIsAdmin(data || false);
          // If they are an admin, we need to get their specific role
          if (data) {
            const { data: roleData } = await supabase
              .rpc('get_user_system_role', { _user_id: user.id })
              .single();
            setRole((roleData as SystemRole) || 'super_admin');
          } else {
            setRole(null);
          }
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

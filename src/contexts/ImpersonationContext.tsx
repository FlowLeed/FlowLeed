import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useImpersonation } from '@/hooks/useImpersonation';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Profile {
  full_name: string;
  email: string;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonationSessionId: string | null;
  impersonatedOrg: Organization | null;
  impersonatedOrgOwner: Profile | null;
  startImpersonation: (orgId: string, reason: string) => Promise<void>;
  endImpersonation: () => Promise<void>;
  logAction: (actionType: string, description: string, metadata?: any) => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export const useImpersonationContext = () => {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error('useImpersonationContext must be used within ImpersonationProvider');
  }
  return context;
};

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonationSessionId, setImpersonationSessionId] = useState<string | null>(null);
  const [impersonatedOrg, setImpersonatedOrg] = useState<Organization | null>(null);
  const [impersonatedOrgOwner, setImpersonatedOrgOwner] = useState<Profile | null>(null);
  
  const { startImpersonation: startImpersonationHook, endImpersonation: endImpersonationHook, logAction: logActionHook } = useImpersonation();

  useEffect(() => {
    // Check for active impersonation session
    const checkImpersonationSession = async () => {
      const sessionId = sessionStorage.getItem('impersonation_session_id');
      
      if (!sessionId) {
        setIsImpersonating(false);
        return;
      }

      try {
        // Fetch session details
        const { data: session, error } = await supabase
          .from('impersonation_sessions')
          .select(`
            id,
            target_organization_id,
            target_user_id,
            is_active
          `)
          .eq('id', sessionId)
          .eq('is_active', true)
          .single();

        if (error || !session) {
          // Invalid or expired session
          sessionStorage.removeItem('impersonation_session_id');
          setIsImpersonating(false);
          return;
        }

        // Fetch organization details
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('id, name, slug')
          .eq('id', session.target_organization_id)
          .single();

        if (orgError) throw orgError;

        // Fetch target user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('user_id', session.target_user_id)
          .single();

        if (profileError) throw profileError;

        setImpersonationSessionId(sessionId);
        setImpersonatedOrg(org);
        setImpersonatedOrgOwner(profile);
        setIsImpersonating(true);
      } catch (error) {
        console.error('Error checking impersonation session:', error);
        sessionStorage.removeItem('impersonation_session_id');
        setIsImpersonating(false);
      }
    };

    checkImpersonationSession();
  }, []);

  const value: ImpersonationContextType = {
    isImpersonating,
    impersonationSessionId,
    impersonatedOrg,
    impersonatedOrgOwner,
    startImpersonation: startImpersonationHook,
    endImpersonation: endImpersonationHook,
    logAction: logActionHook,
  };

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
};

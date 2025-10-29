import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ImpersonationSession {
  sessionId: string;
  targetOrgId: string;
  targetOrgName: string;
  targetUserId: string;
  reason: string;
  startedAt: string;
  adminUserId: string;
}

const SESSION_KEY = 'impersonation_session';
const MAX_SESSION_HOURS = 4;

export const useImpersonation = () => {
  const [session, setSession] = useState<ImpersonationSession | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    // Load session from sessionStorage
    const loadSession = () => {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        try {
          const parsed: ImpersonationSession = JSON.parse(stored);
          
          // Check if session is expired (4 hours)
          const startedAt = new Date(parsed.startedAt);
          const now = new Date();
          const hoursDiff = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
          
          if (hoursDiff > MAX_SESSION_HOURS) {
            console.warn('Impersonation session expired');
            endImpersonation();
            return;
          }
          
          setSession(parsed);
          setIsImpersonating(true);
        } catch (error) {
          console.error('Failed to parse impersonation session:', error);
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
    };

    loadSession();
  }, []);

  // Track page visits during impersonation
  useEffect(() => {
    if (isImpersonating && session) {
      logAction('page_view', `Viewed page: ${window.location.pathname}`, {
        path: window.location.pathname,
        search: window.location.search,
      });
    }
  }, [isImpersonating, session, window.location.pathname]);

  const startImpersonation = async (
    targetOrgId: string,
    targetOrgName: string,
    targetUserId: string,
    reason: string,
    adminUserId: string
  ) => {
    try {
      console.log('[useImpersonation] Starting impersonation for:', targetOrgName);
      
      // Call database function to create session
      const { data: sessionId, error } = await supabase.rpc(
        'start_impersonation_session' as any,
        {
          _target_org_id: targetOrgId,
          _reason: reason,
          _ip_address: null, // Browser doesn't have direct access to IP
          _user_agent: navigator.userAgent,
        }
      );

      if (error) {
        console.error('[useImpersonation] Failed to start session:', error);
        throw error;
      }

      const sessionData: ImpersonationSession = {
        sessionId: sessionId as string,
        targetOrgId,
        targetOrgName,
        targetUserId,
        reason,
        startedAt: new Date().toISOString(),
        adminUserId,
      };

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      setSession(sessionData);
      setIsImpersonating(true);

      console.log('[useImpersonation] Session started successfully:', sessionId);
      return { success: true, sessionId };
    } catch (error: any) {
      console.error('[useImpersonation] Failed to start impersonation:', error);
      return { success: false, error: error.message };
    }
  };

  const endImpersonation = async () => {
    console.log('[useImpersonation] Ending impersonation session');
    
    // Always clear local state first (bulletproof)
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setIsImpersonating(false);

    // Try to end session in DB, but don't block navigation if it fails
    if (session) {
      try {
        await supabase.rpc('end_impersonation_session' as any, {
          _session_id: session.sessionId,
        });
        console.log('[useImpersonation] Session ended successfully in DB');
      } catch (error) {
        console.error('[useImpersonation] Failed to end session in DB (continuing anyway):', error);
      }
    }
    
    // Always navigate back to admin regardless of DB call result
    window.location.href = '/fl-admin/organizations';
  };

  const logAction = async (
    actionType: string,
    description: string,
    metadata?: any
  ) => {
    if (!session) return;

    try {
      await supabase.rpc('log_impersonation_action' as any, {
        _session_id: session.sessionId,
        _action_type: actionType,
        _action_description: description,
        _page_url: window.location.href,
        _metadata: metadata || {},
      });
    } catch (error) {
      console.error('Failed to log impersonation action:', error);
    }
  };

  return {
    isImpersonating,
    session,
    startImpersonation,
    endImpersonation,
    logAction,
  };
};

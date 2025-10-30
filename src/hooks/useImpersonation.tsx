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
      
      // Step 1: Get current admin session and store it
      const { data: { session: adminSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !adminSession) {
        throw new Error('Failed to get admin session');
      }

      console.log('[useImpersonation] Storing admin session backup');
      sessionStorage.setItem('admin_session_backup', JSON.stringify({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
        expires_at: adminSession.expires_at,
      }));

      // Step 2: Call edge function to generate impersonation token
      console.log('[useImpersonation] Generating impersonation token');
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        'generate-impersonation-token',
        {
          body: {
            targetUserId,
            targetOrgId,
            reason,
          },
        }
      );

      if (tokenError || !tokenData) {
        console.error('[useImpersonation] Failed to generate token:', tokenError);
        throw new Error(tokenError?.message || 'Failed to generate impersonation token');
      }

      console.log('[useImpersonation] Token generated, session ID:', tokenData.sessionId);

      // Step 3: Store impersonation metadata
      const sessionData: ImpersonationSession = {
        sessionId: tokenData.sessionId,
        targetOrgId,
        targetOrgName,
        targetUserId,
        reason,
        startedAt: new Date().toISOString(),
        adminUserId,
      };

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));

      // Step 4: Sign in as target user using the magic link token
      console.log('[useImpersonation] Signing in as target user with magic link token');
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenData.token,
        type: 'magiclink',
      });
      
      if (verifyError) {
        console.error('[useImpersonation] Failed to verify magic link token:', verifyError);
        throw verifyError;
      }

      // Step 5: Reload to apply new session
      console.log('[useImpersonation] Session swap complete, reloading...');
      window.location.reload();
      
      return { success: true, sessionId: tokenData.sessionId };
    } catch (error: any) {
      console.error('[useImpersonation] Failed to start impersonation:', error);
      // Clean up on failure
      sessionStorage.removeItem('admin_session_backup');
      sessionStorage.removeItem(SESSION_KEY);
      return { success: false, error: error.message };
    }
  };

  const endImpersonation = async () => {
    console.log('[useImpersonation] Ending impersonation session');
    
    try {
      // Step 1: End session in DB
      if (session) {
        try {
          await supabase.rpc('end_impersonation_session' as any, {
            _session_id: session.sessionId,
          });
          console.log('[useImpersonation] Session ended in DB');
        } catch (error) {
          console.error('[useImpersonation] Failed to end session in DB:', error);
        }
      }

      // Step 2: Retrieve admin session backup
      const adminSessionStr = sessionStorage.getItem('admin_session_backup');
      
      if (!adminSessionStr) {
        console.warn('[useImpersonation] No admin session backup found, signing out');
        await supabase.auth.signOut();
        window.location.href = '/fl-admin/auth';
        return;
      }

      const adminSession = JSON.parse(adminSessionStr);
      console.log('[useImpersonation] Restoring admin session');

      // Step 3: Restore admin session
      const { error: restoreError } = await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });

      if (restoreError) {
        console.error('[useImpersonation] Failed to restore admin session:', restoreError);
        await supabase.auth.signOut();
        window.location.href = '/fl-admin/auth';
        return;
      }

      // Step 4: Clean up
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem('admin_session_backup');
      setSession(null);
      setIsImpersonating(false);

      console.log('[useImpersonation] Admin session restored, navigating to admin panel');
      
      // Step 5: Navigate back to admin
      window.location.href = '/fl-admin';
    } catch (error) {
      console.error('[useImpersonation] Error ending impersonation:', error);
      // Fallback: clear everything and go to admin auth
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem('admin_session_backup');
      await supabase.auth.signOut();
      window.location.href = '/fl-admin/auth';
    }
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

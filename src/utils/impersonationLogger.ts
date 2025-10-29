import { supabase } from '@/integrations/supabase/client';

const SESSION_KEY = 'impersonation_session';

export const logImpersonationAction = async (
  actionType: string,
  description: string,
  metadata?: any
) => {
  // Check if currently impersonating
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (!stored) return; // Not impersonating, skip logging

  try {
    const session = JSON.parse(stored);
    
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

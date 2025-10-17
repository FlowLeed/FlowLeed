import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useImpersonation = () => {
  const startImpersonation = async (orgId: string, reason: string) => {
    try {
      // Get user's IP address
      let ipAddress = 'unknown';
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
      } catch (error) {
        console.error('Could not fetch IP address:', error);
      }

      // Call RPC function to start impersonation session
      const { data: sessionId, error } = await supabase.rpc('start_impersonation_session', {
        _target_org_id: orgId,
        _reason: reason,
        _ip_address: ipAddress,
        _user_agent: navigator.userAgent
      });

      if (error) throw error;

      // Store session ID in sessionStorage (NOT localStorage!)
      sessionStorage.setItem('impersonation_session_id', sessionId);

      toast({
        title: "Impersonation Started",
        description: "You are now viewing the organization. Redirecting...",
      });

      // Reload page to switch context
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (error: any) {
      console.error('Error starting impersonation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start impersonation session",
        variant: "destructive",
      });
      throw error;
    }
  };

  const endImpersonation = async () => {
    const sessionId = sessionStorage.getItem('impersonation_session_id');
    if (!sessionId) return;

    try {
      const { error } = await supabase.rpc('end_impersonation_session', {
        _session_id: sessionId
      });

      if (error) throw error;

      sessionStorage.removeItem('impersonation_session_id');

      toast({
        title: "Impersonation Ended",
        description: "Returning to admin dashboard...",
      });

      // Redirect to admin dashboard
      setTimeout(() => {
        window.location.href = '/admin/organizations';
      }, 500);
    } catch (error: any) {
      console.error('Error ending impersonation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to end impersonation session",
        variant: "destructive",
      });
    }
  };

  const logAction = async (
    actionType: string,
    description: string,
    metadata?: Record<string, any>
  ) => {
    const sessionId = sessionStorage.getItem('impersonation_session_id');
    if (!sessionId) return;

    try {
      await supabase.rpc('log_impersonation_action', {
        _session_id: sessionId,
        _action_type: actionType,
        _action_description: description,
        _page_url: window.location.href,
        _metadata: metadata || {}
      });
    } catch (error) {
      console.error('Error logging impersonation action:', error);
    }
  };

  return { startImpersonation, endImpersonation, logAction };
};

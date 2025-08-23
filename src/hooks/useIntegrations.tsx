import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { useToast } from './use-toast';

interface Integration {
  id: string;
  service_name: string;
  status: string;
  credentials: any;
  settings: any;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

interface IntegrationLog {
  id: string;
  action: string;
  status: string;
  message: string;
  details: any;
  created_at: string;
}

export const useIntegrations = () => {
  const { user } = useAuth();
  const { organization } = useProfile();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && organization) {
      fetchIntegrations();
    }
  }, [user, organization]);

  const fetchIntegrations = async () => {
    if (!organization) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast({
        title: "Error",
        description: "Failed to fetch integrations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (integrationId?: string) => {
    if (!organization) return;

    try {
      let query = supabase
        .from('integration_logs')
        .select(`
          *,
          integrations!inner(organization_id)
        `)
        .eq('integrations.organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (integrationId) {
        query = query.eq('integration_id', integrationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const connectPlanningCenter = async (appId: string, secret: string) => {
    if (!organization) return { error: 'No organization found' };

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('planning-center-integration', {
        body: {
          action: 'connect',
          appId,
          secret,
          organizationId: organization.id
        }
      });

      if (error) throw error;

      await fetchIntegrations();
      
      toast({
        title: "Success",
        description: "Planning Center connected successfully",
      });

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to connect to Planning Center';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (serviceName: string) => {
    if (!organization) return { error: 'No organization found' };

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('planning-center-integration', {
        body: {
          action: 'test',
          organizationId: organization.id
        }
      });

      if (error) throw error;

      await fetchIntegrations();

      toast({
        title: data.success ? "Success" : "Error",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });

      return data;
    } catch (error: any) {
      const errorMessage = error.message || 'Connection test failed';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const syncData = async (serviceName: string) => {
    if (!organization) return { error: 'No organization found' };

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('planning-center-integration', {
        body: {
          action: 'sync',
          organizationId: organization.id
        }
      });

      if (error) throw error;

      await fetchIntegrations();

      toast({
        title: "Success",
        description: data.message,
      });

      return data;
    } catch (error: any) {
      const errorMessage = error.message || 'Sync failed';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async (serviceName: string) => {
    if (!organization) return { error: 'No organization found' };

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('planning-center-integration', {
        body: {
          action: 'disconnect',
          organizationId: organization.id
        }
      });

      if (error) throw error;

      await fetchIntegrations();

      toast({
        title: "Success",
        description: "Integration disconnected successfully",
      });

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to disconnect';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const getIntegration = (serviceName: string) => {
    return integrations.find(i => i.service_name === serviceName);
  };

  const isConnected = (serviceName: string) => {
    const integration = getIntegration(serviceName);
    return integration?.status === 'connected';
  };

  return {
    integrations,
    logs,
    loading,
    fetchIntegrations,
    fetchLogs,
    connectPlanningCenter,
    testConnection,
    syncData,
    disconnect,
    getIntegration,
    isConnected,
  };
};
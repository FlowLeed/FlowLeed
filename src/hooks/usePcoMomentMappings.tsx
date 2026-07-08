import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PcoMomentMapping {
  id: string;
  organization_id: string;
  integration_id: string;
  pco_source_type: 'custom_tab_field' | 'group' | 'workflow';
  pco_source_identifier: string;
  pco_source_label: string;
  pco_tab_name?: string;
  flow_moment_type_id: string;
  trigger_condition: {
    operator: string;
    value: string | null;
  };
  rule_combinator: 'AND' | 'OR';
  condition_group: number;
  is_active: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
  flow_moment_types?: {
    name: string;
    icon?: string;
    color?: string;
  };
}

export interface RuleCondition {
  fieldId: string;
  fieldLabel: string;
  tabName?: string;
  operator: string;
  value: string | null;
  condition_group: number;
}

export interface MomentRule {
  momentTypeId: string;
  combinator: 'AND' | 'OR';
  conditions: RuleCondition[];
}

export function usePcoMomentMappings(integrationId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: mappings, isLoading } = useQuery({
    queryKey: ['pco-moment-mappings', integrationId],
    queryFn: async () => {
      if (!integrationId) return [];
      const { data, error } = await supabase
        .from('pco_moment_mappings')
        .select('*, flow_moment_types(name, icon, color)')
        .eq('integration_id', integrationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PcoMomentMapping[];
    },
    enabled: !!integrationId,
  });

  const createMapping = useMutation({
    mutationFn: async (data: Partial<PcoMomentMapping>) => {
      const { data: result, error } = await supabase
        .from('pco_moment_mappings')
        .insert([data as any])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pco-moment-mappings'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMapping = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PcoMomentMapping> }) => {
      const { error } = await supabase
        .from('pco_moment_mappings')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pco-moment-mappings'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pco_moment_mappings')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pco-moment-mappings'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveRule = useMutation({
    mutationFn: async ({
      organizationId,
      rule,
    }: {
      organizationId: string;
      rule: MomentRule;
    }) => {
      if (!integrationId) throw new Error('No integration');
      if (rule.conditions.length === 0) throw new Error('Add at least one condition');

      // Delete existing rows for this rule, then insert all new ones.
      const { error: delError } = await supabase
        .from('pco_moment_mappings')
        .delete()
        .eq('integration_id', integrationId)
        .eq('flow_moment_type_id', rule.momentTypeId);
      if (delError) throw delError;

      const rows = rule.conditions.map((c) => ({
        organization_id: organizationId,
        integration_id: integrationId,
        pco_source_type: 'custom_tab_field' as const,
        pco_source_identifier: c.fieldId,
        pco_source_label: c.fieldLabel,
        pco_tab_name: c.tabName ?? null,
        flow_moment_type_id: rule.momentTypeId,
        trigger_condition: { operator: c.operator, value: c.value },
        rule_combinator: rule.combinator,
        condition_group: c.condition_group,
        is_active: true,
      }));

      const { error: insError } = await supabase
        .from('pco_moment_mappings')
        .insert(rows as any);
      if (insError) throw insError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pco-moment-mappings'] });
      toast({ title: "Saved", description: "Moment rule updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (momentTypeId: string) => {
      if (!integrationId) throw new Error('No integration');
      const { error } = await supabase
        .from('pco_moment_mappings')
        .delete()
        .eq('integration_id', integrationId)
        .eq('flow_moment_type_id', momentTypeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pco-moment-mappings'] });
      toast({ title: "Deleted", description: "Moment rule removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return {
    mappings: mappings || [],
    isLoading,
    createMapping,
    updateMapping,
    deleteMapping,
    saveRule,
    deleteRule,
  };
}

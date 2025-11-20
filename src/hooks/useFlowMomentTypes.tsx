import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export interface FlowMomentType {
  id: string;
  organization_id: string;
  name: string;
  category: 'salvation' | 'next_step' | 'serving' | 'group' | 'other';
  weight: number;
  description?: string;
  icon?: string;
  color?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useFlowMomentTypes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: organizationId } = useQuery({
    queryKey: ['user-organization', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      return data?.organization_id || null;
    },
    enabled: !!user?.id,
  });

  const { data: momentTypes, isLoading } = useQuery({
    queryKey: ['flow-moment-types', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('flow_moment_types')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('weight', { ascending: false });
      
      if (error) throw error;
      return data as FlowMomentType[];
    },
    enabled: !!organizationId,
  });

  const createMomentType = useMutation({
    mutationFn: async (data: Partial<FlowMomentType>) => {
      if (!organizationId) throw new Error('No organization');
      const { data: result, error } = await supabase
        .from('flow_moment_types')
        .insert([{ ...data, organization_id: organizationId } as any])
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-moment-types'] });
      toast({
        title: "Success",
        description: "Moment type created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMomentType = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FlowMomentType> }) => {
      const { error } = await supabase
        .from('flow_moment_types')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-moment-types'] });
      toast({
        title: "Success",
        description: "Moment type updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMomentType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('flow_moment_types')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-moment-types'] });
      toast({
        title: "Success",
        description: "Moment type deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const seedDefaultTypes = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('No organization');
      const { error } = await supabase.rpc('seed_default_moment_types', {
        org_id: organizationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-moment-types'] });
      toast({
        title: "Success",
        description: "Default moment types added",
      });
    },
  });

  return {
    momentTypes: momentTypes || [],
    isLoading,
    organizationId,
    createMomentType,
    updateMomentType,
    deleteMomentType,
    seedDefaultTypes,
  };
}

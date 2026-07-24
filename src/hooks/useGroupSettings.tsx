import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface GroupSettings {
  organization_id: string;
  default_meeting_frequency: string | null;
  default_visibility: string | null;
  default_allow_public_signup: boolean | null;
  default_capacity: number | null;
  directory_enabled: boolean;
  directory_hero_title: string | null;
  directory_hero_subtitle: string | null;
  directory_show_meeting_time: boolean;
  directory_show_location: boolean;
  directory_show_capacity: boolean;
  auto_inactive_weeks: number | null;
  attendance_reminder_enabled: boolean;
  attendance_reminder_day: number | null;
}

export const useGroupSettings = (organizationId: string | undefined) => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["group-settings", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("group_settings")
        .select("*")
        .eq("organization_id", organizationId!)
        .maybeSingle();
      if (error) throw error;
      return data as GroupSettings | null;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<GroupSettings>) => {
      const { data, error } = await (supabase as any)
        .from("group_settings")
        .upsert({ organization_id: organizationId, ...updates }, { onConflict: "organization_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group-settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return { settings, isLoading, updateSettings };
};

export const useGroupSettingsPublic = (organizationId: string | undefined) => {
  return useQuery({
    queryKey: ["group-settings-public", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("group_settings")
        .select("*")
        .eq("organization_id", organizationId!)
        .maybeSingle();
      if (error) throw error;
      return data as GroupSettings | null;
    },
  });
};

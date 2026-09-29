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
  signup_confirmation_enabled: boolean;
  signup_confirmation_subject: string | null;
  signup_confirmation_body: string | null;
  leader_notification_enabled: boolean;
  leader_notification_subject: string | null;
  leader_notification_body: string | null;
  communication_reply_to: string | null;
}

export const DEFAULT_SIGNUP_CONFIRMATION_SUBJECT = "We got your signup for {{group_name}}";
export const DEFAULT_SIGNUP_CONFIRMATION_BODY = `Hi {{name}},

Thanks for signing up for {{group_name}}! A group leader will review your request and reach out with next steps.

{{meeting_details}}

See you soon,
{{org_name}}`;

export const DEFAULT_LEADER_NOTIFICATION_SUBJECT = "New signup request for {{group_name}}";
export const DEFAULT_LEADER_NOTIFICATION_BODY = `{{name}} just requested to join {{group_name}}.

Email: {{email}}
Phone: {{phone}}

Log in to {{org_name}} to approve or decline this request.`;

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
      // Anonymous visitors can't read group_settings directly (RLS); this
      // security-definer RPC exposes only the directory display fields.
      const { data, error } = await (supabase as any).rpc("get_public_group_settings", {
        p_org_id: organizationId!,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as Pick<
        GroupSettings,
        | "directory_hero_title"
        | "directory_hero_subtitle"
        | "directory_show_meeting_time"
        | "directory_show_location"
        | "directory_show_capacity"
      > | undefined) ?? null;
    },
  });
};

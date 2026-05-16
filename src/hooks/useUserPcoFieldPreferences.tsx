import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";

export interface PcoFieldPreferences {
  selected_field_ids: string[];
  hide_empty: boolean;
}

export function useUserPcoFieldPreferences() {
  const { user } = useAuth();
  const { organization } = useProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const orgId = organization?.id;

  const queryKey = ["user-pco-field-preferences", user?.id, orgId];

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!user?.id && !!orgId,
    queryFn: async (): Promise<PcoFieldPreferences> => {
      const { data, error } = await supabase
        .from("user_pco_field_preferences")
        .select("selected_field_ids, hide_empty")
        .eq("user_id", user!.id)
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? { selected_field_ids: [], hide_empty: true };
    },
  });

  const save = useMutation({
    mutationFn: async (prefs: PcoFieldPreferences) => {
      if (!user?.id || !orgId) throw new Error("Not ready");
      const { error } = await supabase
        .from("user_pco_field_preferences")
        .upsert(
          {
            user_id: user.id,
            organization_id: orgId,
            selected_field_ids: prefs.selected_field_ids,
            hide_empty: prefs.hide_empty,
          },
          { onConflict: "user_id,organization_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Preferences saved" });
    },
    onError: (e: any) => {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    },
  });

  return {
    preferences: data ?? { selected_field_ids: [], hide_empty: true },
    isLoading,
    save,
  };
}

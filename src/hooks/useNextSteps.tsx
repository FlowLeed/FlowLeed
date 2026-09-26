import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NextStepPreset {
  id: string;
  organization_id: string;
  category: string | null;
  is_global: boolean;
  headline: string;
  description: string | null;
  button_label: string;
  destination_type: "url" | "form";
  destination_url: string | null;
  form_id: string | null;
}

export interface PublishedForm { id: string; name: string; slug: string; is_published: boolean }

export function useNextSteps(orgId?: string) {
  const qc = useQueryClient();
  const key = ["story-next-steps", orgId];
  const presets = useQuery({
    queryKey: key,
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase.from("content_story_cta_defaults" as never).select("*").eq("organization_id", orgId ?? "").order("is_global", { ascending: false }).order("category");
      if (error) throw error;
      return (data ?? []) as unknown as NextStepPreset[];
    },
  });
  const forms = useQuery({
    queryKey: ["story-next-step-forms", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase.from("forms").select("id,name,slug,is_published").eq("organization_id", orgId ?? "").order("name");
      if (error) throw error;
      return (data ?? []) as PublishedForm[];
    },
  });
  const upsert = useMutation({
    mutationFn: async (row: Partial<NextStepPreset> & { organization_id: string }) => {
      const { error } = await supabase.from("content_story_cta_defaults" as never).upsert(row as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_story_cta_defaults" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  return { presets: presets.data ?? [], forms: forms.data ?? [], isLoading: presets.isLoading, upsert, remove };
}

export function describeDestination(p: NextStepPreset, forms: PublishedForm[]) {
  if (p.destination_type === "form") return forms.find((f) => f.id === p.form_id)?.name ? `Form: ${forms.find((f) => f.id === p.form_id)!.name}` : "Form unavailable";
  return p.destination_url || "No link";
}

export function resolvePreset(presets: NextStepPreset[], mode: string, presetId: string | null, category: string) {
  if (mode === "preset" && presetId) { const p = presets.find((x) => x.id === presetId); if (p) return p; }
  const cat = category.trim().toLowerCase();
  return (cat && presets.find((p) => !p.is_global && p.category?.toLowerCase() === cat)) || presets.find((p) => p.is_global) || null;
}

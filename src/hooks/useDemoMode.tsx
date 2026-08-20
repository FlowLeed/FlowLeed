import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "@/hooks/use-toast";

interface DemoStatus {
  demoContacts: number;
  realContacts: number;
  seededAt: string | null;
  clearedAt: string | null;
  hasPcoIntegration: boolean;
  hasImports: boolean;
}


/**
 * Demo ("sample church") mode.
 *
 * A brand-new organization with no people gets a fictional church seeded so the
 * app is explorable immediately. Everything demo is flagged `is_demo` and is
 * removed in one shot by "Set Up My Church".
 */
export function useDemoMode() {
  const { organization } = useProfile();
  const orgId = organization?.id;
  const queryClient = useQueryClient();
  const autoSeedAttempted = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["demo-status", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<DemoStatus> => {
      const [demo, real, org, pco, imports] = await Promise.all([
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId!)
          .eq("is_demo", true),
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId!)
          .eq("is_demo", false),
        supabase
          .from("organizations")
          .select("demo_seeded_at, demo_cleared_at")
          .eq("id", orgId!)
          .maybeSingle(),
        supabase
          .from("integrations")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId!)
          .eq("service_name", "planning_center"),
        supabase
          .from("contact_imports")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId!),
      ]);

      return {
        demoContacts: demo.count ?? 0,
        realContacts: real.count ?? 0,
        seededAt: org.data?.demo_seeded_at ?? null,
        clearedAt: org.data?.demo_cleared_at ?? null,
        hasPcoIntegration: (pco.count ?? 0) > 0,
        hasImports: (imports.count ?? 0) > 0,
      };

    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["demo-status", orgId] });
    ["contacts", "pipelines", "flows", "groups", "dashboard-metrics", "my-flows", "flow-moments"].forEach(
      (key) => queryClient.invalidateQueries({ queryKey: [key] }),
    );
  };

  const seed = useMutation({
    mutationFn: async () => {
      const { data: res, error } = await supabase.functions.invoke("demo-data-seed");
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      return res;
    },
    onSuccess: () => invalidateAll(),
  });

  const clear = useMutation({
    mutationFn: async () => {
      const { data: res, error } = await supabase.functions.invoke("demo-data-clear");
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      return res;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Sample data removed", description: "Your church starts with a clean slate." });
    },
    onError: (e: Error) =>
      toast({ title: "Couldn't remove sample data", description: e.message, variant: "destructive" }),
  });

  // Auto-seed a sample church for a brand-new, empty organization.
  useEffect(() => {
    if (!orgId || isLoading || !data || autoSeedAttempted.current) return;
    const isBrandNew =
      data.demoContacts === 0 && data.realContacts === 0 && !data.seededAt && !data.clearedAt;
    if (!isBrandNew) return;
    autoSeedAttempted.current = true;
    seed.mutate();
  }, [orgId, isLoading, data]);

  return {
    isLoading,
    isDemoMode: (data?.demoContacts ?? 0) > 0,
    demoContacts: data?.demoContacts ?? 0,
    realContacts: data?.realContacts ?? 0,
    wasCleared: !!data?.clearedAt,
    seedDemoData: seed.mutateAsync,
    clearDemoData: clear.mutateAsync,
    isSeeding: seed.isPending,
    isClearing: clear.isPending,
  };
}

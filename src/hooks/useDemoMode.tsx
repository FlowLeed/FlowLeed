import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "@/hooks/use-toast";
import { useOptionalFlowContext } from "@/contexts/FlowContext";


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
  const navigate = useNavigate();
  const autoSeedAttempted = useRef(false);
  // FlowContext keeps flows in local state, so seeding/clearing must tell it to reload.
  const flowCtx = useOptionalFlowContext();


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
    onSuccess: async () => {
      invalidateAll();
      await flowCtx?.refreshFlows();
      // Land the user on a flow that actually has sample people in it, so the
      // banner never shows above an empty board.
      if (!orgId) return;
      const { data: demoFlow } = await supabase
        .from("pipelines")
        .select("id")
        .eq("organization_id", orgId)
        .eq("is_demo", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const path = window.location.pathname;
      if (demoFlow?.id && (path === "/" || path.startsWith("/flows/"))) {
        navigate(`/flows/${demoFlow.id}`, { replace: true });
      }
    },
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

  // Auto-seed a sample church for a brand-new, empty organization only.
  // Skip orgs that already removed sample data, connected Planning Center, or imported a CSV.
  useEffect(() => {
    if (!orgId || isLoading || !data || autoSeedAttempted.current) return;
    const isBrandNew =
      data.demoContacts === 0 &&
      data.realContacts === 0 &&
      !data.seededAt &&
      !data.clearedAt &&
      !data.hasPcoIntegration &&
      !data.hasImports;
    if (!isBrandNew) return;
    autoSeedAttempted.current = true;
    seed.mutate();
  }, [orgId, isLoading, data]);

  const hasOwnData = !!data && (data.hasPcoIntegration || data.hasImports || data.realContacts > 0);

  return {
    isLoading,
    isDemoMode: (data?.demoContacts ?? 0) > 0,
    demoContacts: data?.demoContacts ?? 0,
    realContacts: data?.realContacts ?? 0,
    wasCleared: !!data?.clearedAt,
    hasPcoIntegration: !!data?.hasPcoIntegration,
    hasImports: !!data?.hasImports,
    hasOwnData,
    // Only offer sample data to orgs that never removed it and have no data of their own.
    canOfferDemo: !!data && !data.clearedAt && !hasOwnData,
    seedDemoData: seed.mutateAsync,
    clearDemoData: clear.mutateAsync,
    isSeeding: seed.isPending,
    isClearing: clear.isPending,
  };

}

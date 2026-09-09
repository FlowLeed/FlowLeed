import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

/**
 * A personal Planning Center sign-in is only needed when:
 *  - the org has an active OAuth Planning Center connection, AND
 *  - per-user PCO visibility enforcement is ON, AND
 *  - the current user is NOT an owner/admin (they always see everything).
 *
 * Owners/admins manage the church-wide connection on the Integrations page, so
 * showing them a second "Connect Planning Center" card is confusing.
 */
export function useNeedsPersonalPco() {
  const { user } = useAuth();
  const { organization } = useProfile();
  const orgId = organization?.id;

  const { data: needed = false, isLoading } = useQuery({
    queryKey: ["needs-personal-pco", user?.id, orgId],
    enabled: !!user?.id && !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [{ data: member }, { data: org }, { data: integ }] = await Promise.all([
        supabase
          .from("organization_members")
          .select("role")
          .eq("organization_id", orgId!)
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase
          .from("organizations")
          .select("pco_enforce_user_permissions")
          .eq("id", orgId!)
          .maybeSingle(),
        supabase
          .from("integrations_public")
          .select("auth_type,status")
          .eq("organization_id", orgId!)
          .eq("service_name", "planning_center")
          .maybeSingle(),
      ]);

      if (["owner", "admin"].includes(member?.role ?? "")) return false;
      if (!(org as any)?.pco_enforce_user_permissions) return false;
      if (!integ || integ.auth_type !== "oauth" || integ.status !== "active") return false;
      return true;
    },
  });

  return { needed, isLoading };
}

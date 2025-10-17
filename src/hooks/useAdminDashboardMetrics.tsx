import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DashboardMetrics {
  totalOrganizations: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  avgHealthScore: number;
}

export const useAdminDashboardMetrics = () => {
  return useQuery({
    queryKey: ["admin-dashboard-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_health_view")
        .select("*");

      if (error) throw error;

      const metrics: DashboardMetrics = {
        totalOrganizations: data?.length || 0,
        activeSubscriptions: data?.filter(
          (org) => org.subscription_status === "active"
        ).length || 0,
        monthlyRevenue: data
          ?.filter((org) => org.subscription_status === "active")
          .reduce((sum, org) => {
            const orgRevenue = parseFloat(org.plan_tier === "starter" ? "49" : 
                                         org.plan_tier === "professional" ? "99" : 
                                         org.plan_tier === "enterprise" ? "299" : "0");
            return sum + orgRevenue;
          }, 0) || 0,
        avgHealthScore: data?.length
          ? Math.round(
              data.reduce((sum, org) => sum + (org.health_score || 0), 0) /
                data.length
            )
          : 0,
      };

      return metrics;
    },
  });
};

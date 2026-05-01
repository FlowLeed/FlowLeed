import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useIsOrgAdmin = (userId: string | undefined) => {
  const { data: isOrgAdmin = false, isLoading } = useQuery({
    queryKey: ["org-role", userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from("organization_members")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.role === "owner" || data?.role === "admin";
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return { isOrgAdmin, isLoading };
};

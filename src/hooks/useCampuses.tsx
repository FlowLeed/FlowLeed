import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Campus {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  pco_campus_id: string;
}

export const useCampuses = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["campuses", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: orgMembers } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1);

      if (!orgMembers || orgMembers.length === 0) return [];

      const { data, error } = await supabase
        .from("campuses")
        .select("id, name, city, state, pco_campus_id")
        .eq("organization_id", orgMembers[0].organization_id)
        .order("name");

      if (error) {
        console.error("Error fetching campuses:", error);
        return [];
      }

      return (data || []) as Campus[];
    },
    enabled: !!user,
  });
};

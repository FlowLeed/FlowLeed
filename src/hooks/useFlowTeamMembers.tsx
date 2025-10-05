import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FlowTeamMember {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export const useFlowTeamMembers = (flowId: string | undefined) => {
  const [teamMembers, setTeamMembers] = useState<FlowTeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!flowId) {
      setTeamMembers([]);
      setLoading(false);
      return;
    }

    const fetchTeamMembers = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("pipeline_team_members")
        .select(`
          user_id,
          role,
          profiles:user_id (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq("pipeline_id", flowId);

      if (error) {
        console.error("Error fetching flow team members:", error);
        setTeamMembers([]);
      } else {
        const members = data.map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          full_name: m.profiles?.full_name,
          email: m.profiles?.email,
          avatar_url: m.profiles?.avatar_url,
        }));
        setTeamMembers(members);
      }
      setLoading(false);
    };

    fetchTeamMembers();
  }, [flowId]);

  return { teamMembers, loading };
};

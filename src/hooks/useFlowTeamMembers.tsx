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
      
      // Step 1: Fetch pipeline team members
      const { data: teamData, error: teamError } = await supabase
        .from("pipeline_team_members")
        .select("user_id, role")
        .eq("pipeline_id", flowId);

      if (teamError) {
        console.error("Error fetching flow team members:", teamError);
        setTeamMembers([]);
        setLoading(false);
        return;
      }

      if (!teamData || teamData.length === 0) {
        setTeamMembers([]);
        setLoading(false);
        return;
      }

      // Step 2: Fetch profiles separately
      const userIds = teamData.map(m => m.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url")
        .in("user_id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        setTeamMembers([]);
        setLoading(false);
        return;
      }

      // Step 3: Combine the data
      const members = teamData.map((m) => {
        const profile = profilesData?.find(p => p.user_id === m.user_id);
        return {
          user_id: m.user_id,
          role: m.role,
          full_name: profile?.full_name || null,
          email: profile?.email || "",
          avatar_url: profile?.avatar_url || null,
        };
      });
      
      setTeamMembers(members);
      setLoading(false);
    };

    fetchTeamMembers();
  }, [flowId]);

  return { teamMembers, loading };
};

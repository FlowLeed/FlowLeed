import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserX } from "lucide-react";

interface StageAssigneeSelectorProps {
  flowId: string;
  currentAssigneeId?: string | null;
  onChange: (userId: string | null) => void;
}

export const StageAssigneeSelector: React.FC<StageAssigneeSelectorProps> = ({
  flowId,
  currentAssigneeId,
  onChange,
}) => {
  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ['flow-team-members', flowId],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from('pipeline_team_members')
        .select('user_id, role')
        .eq('pipeline_id', flowId);

      if (error) throw error;
      if (!members || members.length === 0) return [];

      const userIds = members.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      return members.map(member => ({
        ...member,
        profile: profiles?.find(p => p.user_id === member.user_id)
      }));
    },
  });

  const handleValueChange = (value: string) => {
    onChange(value === 'none' ? null : value);
  };

  return (
    <Select
      value={currentAssigneeId || 'none'}
      onValueChange={handleValueChange}
      disabled={isLoading}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select team member..." />
      </SelectTrigger>
      <SelectContent className="bg-background">
        <SelectItem value="none">
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-muted-foreground" />
            <span>No auto-assignment</span>
          </div>
        </SelectItem>
        
        {teamMembers?.map((member) => (
          <SelectItem key={member.user_id} value={member.user_id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={member.profile?.avatar_url || ''} />
                <AvatarFallback className="text-xs">
                  {member.profile?.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <span>{member.profile?.full_name || 'Unknown'}</span>
              <span className="text-xs text-muted-foreground">
                ({member.role})
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

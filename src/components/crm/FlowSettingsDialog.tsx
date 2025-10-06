import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, X, Star, Wrench, User } from "lucide-react";

interface FlowTeamMember {
  id: string;
  user_id: string;
  role: 'lead' | 'manager' | 'contributor';
  profiles: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface OrganizationMember {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface FlowSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId: string;
  flowName: string;
  organizationId: string;
}

export const FlowSettingsDialog = ({
  open,
  onOpenChange,
  flowId,
  flowName,
  organizationId,
}: FlowSettingsDialogProps) => {
  const [teamMembers, setTeamMembers] = useState<FlowTeamMember[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrganizationMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<'contributor' | 'manager'>('contributor');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTeamMembers();
      fetchOrgMembers();
    }
  }, [open, flowId]);

  const fetchTeamMembers = async () => {
    const { data, error } = await supabase
      .from("pipeline_team_members")
      .select(`
        id,
        user_id,
        role,
        profiles (
          full_name,
          email,
          avatar_url
        )
      `)
      .eq("pipeline_id", flowId)
      .order("role", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive",
      });
      return;
    }

    setTeamMembers(data as any);
  };

  const fetchOrgMembers = async () => {
    const { data, error } = await supabase
      .from("organization_members")
      .select(`
        user_id,
        profiles:user_id (
          full_name,
          email,
          avatar_url
        )
      `)
      .eq("organization_id", organizationId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load organization members",
        variant: "destructive",
      });
      return;
    }

    const members = data.map((m: any) => ({
      user_id: m.user_id,
      full_name: m.profiles?.full_name,
      email: m.profiles?.email,
      avatar_url: m.profiles?.avatar_url,
    }));

    setOrgMembers(members);
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    setLoading(true);
    const { error } = await supabase
      .from("pipeline_team_members")
      .insert({
        pipeline_id: flowId,
        user_id: selectedUserId,
        role: selectedRole,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add team member",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Team member added successfully",
      });
      fetchTeamMembers();
      setSelectedUserId("");
      setSelectedRole('contributor');
    }
    setLoading(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from("pipeline_team_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Team member removed successfully",
      });
      fetchTeamMembers();
    }
    setLoading(false);
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    setLoading(true);
    const { error } = await supabase
      .from("pipeline_team_members")
      .update({ role: newRole })
      .eq("id", memberId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Role updated successfully",
      });
      fetchTeamMembers();
    }
    setLoading(false);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'lead':
        return <Star className="h-4 w-4" />;
      case 'manager':
        return <Wrench className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    switch (role) {
      case 'lead':
        return 'default';
      case 'manager':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const availableMembers = orgMembers.filter(
    (om) => !teamMembers.some((tm) => tm.user_id === om.user_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Team - {flowName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Member Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Add Team Member</h3>
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'contributor' | 'manager')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contributor">Contributor</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={handleAddMember}
                disabled={!selectedUserId || loading}
                size="icon"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Current Team Members */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Team Members ({teamMembers.length})</h3>
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.profiles.avatar_url || undefined} />
                      <AvatarFallback>
                        {(member.profiles.full_name || member.profiles.email)
                          .charAt(0)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {member.profiles.full_name || "Unknown"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.profiles.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={member.role}
                      onValueChange={(v) => handleChangeRole(member.id, v)}
                      disabled={member.role === 'lead' || loading}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue>
                          <div className="flex items-center gap-2">
                            {getRoleIcon(member.role)}
                            <span className="capitalize">{member.role}</span>
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lead" disabled>Lead</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="contributor">Contributor</SelectItem>
                      </SelectContent>
                    </Select>

                    {member.role !== 'lead' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

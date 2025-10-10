import React, { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserPlus, MoreHorizontal, Shield, Crown, User, Mail, Clock, CheckCircle, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InviteTeamMemberDialog } from "@/components/team/InviteTeamMemberDialog";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
  profile: {
    full_name?: string;
    email: string;
    avatar_url?: string;
  };
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  token: string;
  created_at: string;
  expires_at: string;
  invited_by: {
    full_name?: string;
    email: string;
  };
}

const TeamPage = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { organization, profile } = useProfile();
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');

  useEffect(() => {
    if (organization) {
      fetchTeamData();
    }
  }, [organization]);

  const fetchTeamData = async () => {
    if (!organization) return;

    try {
      setLoading(true);

      // Fetch team members - separate queries to avoid relation issues
      const { data: memberData, error: membersError } = await supabase
        .from('organization_members')
        .select('id, user_id, role, created_at')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;

      if (memberData && memberData.length > 0) {
        // Get user IDs to fetch profiles
        const userIds = memberData.map(member => member.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        const membersWithProfiles: TeamMember[] = memberData.map(member => {
          const memberProfile = profilesData?.find(profile => profile.user_id === member.user_id);
          return {
            ...member,
            role: member.role as 'owner' | 'admin' | 'member',
            profile: memberProfile || { email: 'Unknown', full_name: undefined, avatar_url: undefined }
          };
        });

        setTeamMembers(membersWithProfiles);

        // Find current user's role
        const currentUser = membersWithProfiles.find(member => member.profile.email === profile?.email);
        if (currentUser) {
          setCurrentUserRole(currentUser.role);
        }
      }

      // Fetch pending invitations - separate query to avoid relation issues
      const { data: invitationData, error: invitationsError } = await supabase
        .from('invitations')
        .select('id, email, role, token, created_at, expires_at, invited_by_user_id')
        .eq('organization_id', organization.id)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString());

      if (invitationsError) throw invitationsError;

      if (invitationData && invitationData.length > 0) {
        // Get inviter profiles
        const inviterIds = invitationData.map(inv => inv.invited_by_user_id);
        const { data: inviterProfiles, error: inviterError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', inviterIds);

        if (inviterError) throw inviterError;

        // Combine invitation data with inviter profiles
        const invitationsWithInviters = invitationData.map(invitation => {
          const inviterProfile = inviterProfiles?.find(profile => profile.user_id === invitation.invited_by_user_id);
          return {
            ...invitation,
            invited_by: inviterProfile || { email: 'Unknown', full_name: undefined }
          };
        });

        setPendingInvitations(invitationsWithInviters);
      }

    } catch (error) {
      console.error('Error fetching team data:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!organization) return;

    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId)
        .eq('organization_id', organization.id);

      if (error) throw error;

      setTeamMembers(prev => prev.filter(member => member.id !== memberId));
      toast.success(`Removed ${memberEmail} from team`);
    } catch (error) {
      console.error('Error removing team member:', error);
      toast.error('Failed to remove team member');
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string, memberEmail: string) => {
    if (!organization) return;

    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .eq('organization_id', organization.id);

      if (error) throw error;

      setTeamMembers(prev => prev.map(member => 
        member.id === memberId ? { ...member, role: newRole as any } : member
      ));
      toast.success(`Updated ${memberEmail}'s role to ${newRole}`);
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleCancelInvitation = async (invitationId: string, email: string) => {
    try {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      toast.success(`Cancelled invitation for ${email}`);
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast.error('Failed to cancel invitation');
    }
  };

  const handleResendInvitation = async (invitation: PendingInvitation) => {
    if (!organization || !profile) return;

    try {
      // Send the invitation email again
      const { error: emailError } = await supabase.functions.invoke('send-invitation-email', {
        body: {
          email: invitation.email,
          organizationName: organization.name,
          inviterName: profile.full_name || profile.email,
          role: invitation.role,
          inviteToken: invitation.token
        }
      });

      if (emailError) {
        console.error('Error resending invitation email:', emailError);
        throw new Error('Failed to resend invitation email');
      }

      toast.success(`Invitation resent to ${invitation.email}`);
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast.error('Failed to resend invitation');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />;
      default:
        return <User className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Owner</Badge>;
      case 'admin':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Admin</Badge>;
      default:
        return <Badge variant="secondary">Member</Badge>;
    }
  };

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="My Organization" 
      />
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Team Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Team Members ({teamMembers.length})
                </CardTitle>
                <CardDescription>
                  Manage your organization's team members and their roles
                </CardDescription>
              </div>
              {canManageMembers && (
                <Button onClick={() => setIsInviteDialogOpen(true)} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite Member
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.profile.avatar_url} />
                      <AvatarFallback>
                        {(member.profile.full_name || member.profile.email).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">
                          {member.profile.full_name || member.profile.email}
                        </h3>
                        {getRoleIcon(member.role)}
                      </div>
                      <p className="text-sm text-gray-600">{member.profile.email}</p>
                      <p className="text-xs text-gray-500">
                        Joined {formatDistanceToNow(new Date(member.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getRoleBadge(member.role)}
                    
                    {canManageMembers && member.role !== 'owner' && member.profile.email !== profile?.email && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleChangeRole(member.id, 'admin', member.profile.email)}>
                            Make Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleChangeRole(member.id, 'member', member.profile.email)}>
                            Make Member
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleRemoveMember(member.id, member.profile.email)}
                            className="text-red-600"
                          >
                            Remove from team
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Pending Invitations ({pendingInvitations.length})
              </CardTitle>
              <CardDescription>
                Team member invitations waiting to be accepted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingInvitations.map((invitation) => (
                  <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg bg-yellow-50">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          <Mail className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium">{invitation.email}</h3>
                        <p className="text-sm text-gray-600">
                          Invited by {invitation.invited_by.full_name || invitation.invited_by.email}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getRoleBadge(invitation.role)}
                      {canManageMembers && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResendInvitation(invitation)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            Resend
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelInvitation(invitation.id, invitation.email)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {canManageMembers && (
        <InviteTeamMemberDialog
          open={isInviteDialogOpen}
          onOpenChange={setIsInviteDialogOpen}
          onInviteSent={() => {
            fetchTeamData();
            setIsInviteDialogOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default TeamPage;
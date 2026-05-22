import React, { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserPlus, MoreHorizontal, Shield, Crown, User, Mail, Clock, X, Tag, Search, Pencil, Trash2, GitMerge, Phone } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InviteTeamMemberDialog } from "@/components/team/InviteTeamMemberDialog";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrgTagManagement } from "@/hooks/useOrgTagManagement";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTwilioNumbers } from "@/hooks/useTwilioNumbers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrganizationPhoneNumbers } from "@/components/admin/OrganizationPhoneNumbers";
import { useFlowTeamMemberships } from "@/hooks/useFlowTeamMemberships";
import { useOrgFlowsMeta } from "@/hooks/useOrgFlowsMeta";
import { FlowIconBadge } from "@/components/search/FlowIconBadge";

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
  twilioNumber?: {
    phone_number: string;
    friendly_name: string | null;
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
  const {
    organization,
    profile
  } = useProfile();
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');

  // Org settings state
  const [orgName, setOrgName] = useState("");
  const [isEditingOrgName, setIsEditingOrgName] = useState(false);

  // Tag management state
  const {
    tagStats,
    isLoading: tagsLoading,
    renameTag,
    deleteTag,
    mergeTags
  } = useOrgTagManagement(organization?.id);
  const { numbers: twilioNumbers, assignNumber } = useTwilioNumbers();
  const { data: flowMemberships } = useFlowTeamMemberships(true);
  const { data: orgFlows } = useOrgFlowsMeta(organization?.id);
  const flowsById = React.useMemo(() => {
    const m = new Map<string, { id: string; name: string; icon: string }>();
    (orgFlows || []).forEach(f => m.set(f.id, f));
    return m;
  }, [orgFlows]);
  const getMemberFlows = (userId: string, role: string) => {
    if (role === 'owner' || role === 'admin') return orgFlows || [];
    const ids = flowMemberships?.get(userId);
    if (!ids) return [];
    const arr: { id: string; name: string; icon: string }[] = [];
    ids.forEach(id => { const f = flowsById.get(id); if (f) arr.push(f); });
    return arr.sort((a, b) => a.name.localeCompare(b.name));
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [tagToRename, setTagToRename] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedTagsForMerge, setSelectedTagsForMerge] = useState<string[]>([]);
  const [mergeTargetTag, setMergeTargetTag] = useState("");
  const filteredTags = tagStats.filter(({
    tag
  }) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
  useEffect(() => {
    if (organization) {
      fetchTeamData();
      setOrgName(organization.name);
    }
  }, [organization]);
  const fetchTeamData = async () => {
    if (!organization) return;
    try {
      setLoading(true);

      // Fetch team members - separate queries to avoid relation issues
      const {
        data: memberData,
        error: membersError
      } = await supabase.from('organization_members').select('id, user_id, role, created_at').eq('organization_id', organization.id).order('created_at', {
        ascending: true
      });
      if (membersError) throw membersError;
      if (memberData && memberData.length > 0) {
        // Get user IDs to fetch profiles
        const userIds = memberData.map(member => member.user_id);
        const {
          data: profilesData,
          error: profilesError
        } = await supabase.from('profiles').select('user_id, full_name, email, avatar_url').in('user_id', userIds);
        if (profilesError) throw profilesError;
        const membersWithProfiles: TeamMember[] = memberData.map(member => {
          const memberProfile = profilesData?.find(profile => profile.user_id === member.user_id);
          const assignedNumber = twilioNumbers.find(num => num.assigned_to_user_id === member.user_id);
          return {
            ...member,
            role: member.role as 'owner' | 'admin' | 'member',
            profile: memberProfile || {
              email: 'Unknown',
              full_name: undefined,
              avatar_url: undefined
            },
            twilioNumber: assignedNumber ? {
              phone_number: assignedNumber.phone_number,
              friendly_name: assignedNumber.friendly_name
            } : undefined
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
      const {
        data: invitationData,
        error: invitationsError
      } = await supabase.from('invitations').select('id, email, role, token, created_at, expires_at, invited_by_user_id').eq('organization_id', organization.id).is('accepted_at', null).gt('expires_at', new Date().toISOString());
      if (invitationsError) throw invitationsError;
      if (invitationData && invitationData.length > 0) {
        // Get inviter profiles
        const inviterIds = invitationData.map(inv => inv.invited_by_user_id);
        const {
          data: inviterProfiles,
          error: inviterError
        } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', inviterIds);
        if (inviterError) throw inviterError;

        // Combine invitation data with inviter profiles
        const invitationsWithInviters = invitationData.map(invitation => {
          const inviterProfile = inviterProfiles?.find(profile => profile.user_id === invitation.invited_by_user_id);
          return {
            ...invitation,
            invited_by: inviterProfile || {
              email: 'Unknown',
              full_name: undefined
            }
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
      const {
        error
      } = await supabase.from('organization_members').delete().eq('id', memberId).eq('organization_id', organization.id);
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
      const {
        error
      } = await supabase.from('organization_members').update({
        role: newRole
      }).eq('id', memberId).eq('organization_id', organization.id);
      if (error) throw error;
      setTeamMembers(prev => prev.map(member => member.id === memberId ? {
        ...member,
        role: newRole as any
      } : member));
      toast.success(`Updated ${memberEmail}'s role to ${newRole}`);
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };
  const handleCancelInvitation = async (invitationId: string, email: string) => {
    try {
      const {
        error
      } = await supabase.from('invitations').delete().eq('id', invitationId);
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
      const {
        error: emailError
      } = await supabase.functions.invoke('send-invitation-email', {
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
        return <Badge variant="secondary">Leader</Badge>;
    }
  };
  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';
  const isOwner = currentUserRole === 'owner';
  const handleUpdateOrgName = async () => {
    if (!organization || !orgName.trim() || orgName === organization.name) {
      setIsEditingOrgName(false);
      return;
    }
    try {
      const {
        error
      } = await supabase.from('organizations').update({
        name: orgName.trim()
      }).eq('id', organization.id);
      if (error) throw error;
      toast.success('Organization name updated');
      setIsEditingOrgName(false);
    } catch (error) {
      console.error('Error updating organization name:', error);
      toast.error('Failed to update organization name');
      setOrgName(organization.name);
    }
  };
  const handleDeleteClick = (tag: string) => {
    setTagToDelete(tag);
    setDeleteDialogOpen(true);
  };
  const handleDeleteConfirm = () => {
    if (tagToDelete) {
      deleteTag(tagToDelete);
      setDeleteDialogOpen(false);
      setTagToDelete(null);
    }
  };
  const handleRenameClick = (tag: string) => {
    setTagToRename(tag);
    setNewTagName(tag);
    setRenameDialogOpen(true);
  };
  const handleRenameConfirm = () => {
    if (tagToRename && newTagName && newTagName !== tagToRename) {
      renameTag({
        oldTag: tagToRename,
        newTag: newTagName
      });
      setRenameDialogOpen(false);
      setTagToRename(null);
      setNewTagName("");
    }
  };
  const toggleTagForMerge = (tag: string) => {
    setSelectedTagsForMerge(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };
  const handleMergeClick = () => {
    if (selectedTagsForMerge.length < 2) {
      return;
    }
    setMergeTargetTag(selectedTagsForMerge[0]);
    setMergeDialogOpen(true);
  };
  const handleMergeConfirm = () => {
    if (selectedTagsForMerge.length >= 2 && mergeTargetTag) {
      mergeTags({
        sourceTags: selectedTagsForMerge,
        targetTag: mergeTargetTag
      });
      setMergeDialogOpen(false);
      setSelectedTagsForMerge([]);
      setMergeTargetTag("");
    }
  };

  const handleAssignPhoneNumber = async (userId: string, phoneNumberId: string | null) => {
    try {
      await assignNumber.mutateAsync({
        phoneNumberId: phoneNumberId || '',
        userId: phoneNumberId ? userId : null,
      });
      fetchTeamData();
    } catch (error) {
      console.error('Error assigning phone number:', error);
    }
  };

  // Get unassigned organization phone numbers
  const unassignedNumbers = twilioNumbers.filter(
    num => num.organization_id === organization?.id && !num.assigned_to_user_id
  );

  // Get organization phone numbers
  const orgPhoneNumbers = twilioNumbers.filter(
    num => num.organization_id === organization?.id
  );
  if (loading) {
    return <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>;
  }
  return <div className="flex flex-col h-full">
      <Header title="My Organization" showFlowIcon={false} showAddButton={false} />
      
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="settings">
              <Shield className="h-4 w-4 mr-2" />
              Org Settings
            </TabsTrigger>
            <TabsTrigger value="members">
              <User className="h-4 w-4 mr-2" />
              Team Members
            </TabsTrigger>
            <TabsTrigger value="phone-numbers">
              <Phone className="h-4 w-4 mr-2" />
              Phone Numbers
            </TabsTrigger>
            <TabsTrigger value="tags">
              <Tag className="h-4 w-4 mr-2" />
              Tag Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-light">Organization Settings</CardTitle>
                <CardDescription>
                  Manage your organization's general settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <div className="flex gap-2">
                    <Input id="orgName" value={orgName} onChange={e => setOrgName(e.target.value)} disabled={!isOwner || !isEditingOrgName} className="flex-1" />
                    {isOwner && <>
                        {!isEditingOrgName ? <Button variant="outline" onClick={() => setIsEditingOrgName(true)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button> : <>
                            <Button variant="default" onClick={handleUpdateOrgName}>
                              Save
                            </Button>
                            <Button variant="outline" onClick={() => {
                        setOrgName(organization?.name || "");
                        setIsEditingOrgName(false);
                      }}>
                              Cancel
                            </Button>
                          </>}
                      </>}
                  </div>
                  {!isOwner && <p className="text-sm text-muted-foreground">
                      Only organization owners can change the organization name.
                    </p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="phone-numbers" className="space-y-6 mt-6">
            {canManageMembers ? (
              <OrganizationPhoneNumbers organizationId={organization?.id || ""} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Phone Numbers</CardTitle>
                  <CardDescription>
                    Only organization owners and admins can manage phone numbers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Contact your organization owner or admin to request access to phone number management.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-6 mt-6">
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
              {canManageMembers && <Button onClick={() => setIsInviteDialogOpen(true)} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite Member
                </Button>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamMembers.map(member => <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.profile.avatar_url} />
                      <AvatarFallback>
                        {(() => {
                          const parts = (member.profile.full_name || '').trim().split(/\s+/).filter(Boolean);
                          if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
                          if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
                          return member.profile.email?.slice(0, 2).toUpperCase() || 'U';
                        })()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-light">
                          {member.profile.full_name || member.profile.email}
                        </h3>
                        {getRoleIcon(member.role)}
                      </div>
                      <p className="text-sm text-gray-600">{member.profile.email}</p>
                      <p className="text-xs text-gray-500">
                        Joined {formatDistanceToNow(new Date(member.created_at), {
                          addSuffix: true
                        })}
                      </p>
                      {(() => {
                        const flows = getMemberFlows(member.user_id, member.role);
                        if (flows.length === 0) return null;
                        const max = 6;
                        const visible = flows.slice(0, max);
                        const overflow = flows.slice(max);
                        const isAll = member.role === 'owner' || member.role === 'admin';
                        return (
                          <div className="flex items-center gap-1 flex-wrap mt-1.5" title={isAll ? 'All flows (org admin)' : flows.map(f => f.name).join(', ')}>
                            {visible.map(f => (
                              <FlowIconBadge key={f.id} flow={{ name: f.name, icon: f.icon }} size="sm" />
                            ))}
                            {overflow.length > 0 && (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px] rounded-full" title={overflow.map(f => f.name).join(', ')}>
                                +{overflow.length}
                              </Badge>
                            )}
                          </div>
                        );
                      })()}
                      {canManageMembers ? (
                        <div className="flex items-center gap-2 mt-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <Select
                            value={member.twilioNumber?.phone_number || 'none'}
                            onValueChange={(value) => {
                              if (value === 'none') {
                                const currentNumber = orgPhoneNumbers.find(
                                  n => n.assigned_to_user_id === member.user_id
                                );
                                if (currentNumber) {
                                  handleAssignPhoneNumber(member.user_id, null);
                                }
                              } else {
                                const selectedNumber = orgPhoneNumbers.find(n => n.phone_number === value);
                                if (selectedNumber) {
                                  handleAssignPhoneNumber(member.user_id, selectedNumber.id);
                                }
                              }
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs w-[180px]">
                              <SelectValue placeholder="No phone assigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No phone assigned</SelectItem>
                              {orgPhoneNumbers.map((num) => (
                                <SelectItem 
                                  key={num.id} 
                                  value={num.phone_number}
                                  disabled={num.assigned_to_user_id !== null && num.assigned_to_user_id !== member.user_id}
                                >
                                  {num.phone_number} {num.friendly_name ? `(${num.friendly_name})` : ''}
                                  {num.assigned_to_user_id && num.assigned_to_user_id !== member.user_id && ' (Assigned)'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : member.twilioNumber && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Phone className="h-3 w-3" />
                          <span>{member.twilioNumber.phone_number}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getRoleBadge(member.role)}
                    
                    {canManageMembers && member.role !== 'owner' && member.profile.email !== profile?.email && <DropdownMenu>
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
                            Make Leader
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRemoveMember(member.id, member.profile.email)} className="text-red-600">
                            Remove from team
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>}
                  </div>
                </div>)}
            </div>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && <Card>
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
                {pendingInvitations.map(invitation => <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg bg-yellow-50">
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
                          Expires {formatDistanceToNow(new Date(invitation.expires_at), {
                          addSuffix: true
                        })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getRoleBadge(invitation.role)}
                      {canManageMembers && <>
                          <Button variant="outline" size="sm" onClick={() => handleResendInvitation(invitation)} className="text-blue-600 hover:text-blue-700">
                            <Mail className="h-4 w-4 mr-1" />
                            Resend
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleCancelInvitation(invitation.id, invitation.email)} className="text-red-600 hover:text-red-700">
                            <X className="h-4 w-4" />
                          </Button>
                        </>}
                    </div>
                  </div>)}
              </div>
            </CardContent>
          </Card>}

            {/* Unassigned Phone Numbers */}
            {unassignedNumbers.length > 0 && canManageMembers && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Unassigned Phone Numbers ({unassignedNumbers.length})
                  </CardTitle>
                  <CardDescription>
                    These phone numbers are available to assign to team members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {unassignedNumbers.map((num) => (
                      <div key={num.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{num.phone_number}</span>
                          {num.friendly_name && (
                            <span className="text-sm text-muted-foreground">
                              ({num.friendly_name})
                            </span>
                          )}
                        </div>
                        <Badge variant="secondary">Available</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="tags" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="h-5 w-5" />
                      Tag Management
                    </CardTitle>
                    <CardDescription>
                      Manage tags across your organization ({tagStats.length} unique tags)
                    </CardDescription>
                  </div>
                  {selectedTagsForMerge.length >= 2 && <Button onClick={handleMergeClick} variant="outline" className="gap-2">
                      <GitMerge className="h-4 w-4" />
                      Merge {selectedTagsForMerge.length} Tags
                    </Button>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search tags..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                  </div>

                  {tagsLoading ? <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div> : <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Select</TableHead>
                          <TableHead>Tag Name</TableHead>
                          <TableHead>Contacts Using</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTags.length === 0 ? <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              No tags found
                            </TableCell>
                          </TableRow> : filteredTags.map(({
                      tag,
                      count
                    }) => <TableRow key={tag}>
                              <TableCell>
                                <input type="checkbox" checked={selectedTagsForMerge.includes(tag)} onChange={() => toggleTagForMerge(tag)} className="cursor-pointer" />
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{tag}</Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {count} {count === 1 ? 'person' : 'people'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => handleRenameClick(tag)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(tag)} className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>)}
                      </TableBody>
                    </Table>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag "{tagToDelete}"? This will remove it from all people in your organization. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Tag</DialogTitle>
            <DialogDescription>
              Enter a new name for the tag "{tagToRename}". This will update the tag for all people using it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-tag-name">New Tag Name</Label>
              <Input id="new-tag-name" value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Enter new tag name" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameConfirm} disabled={!newTagName || newTagName === tagToRename}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Tags Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Tags</DialogTitle>
            <DialogDescription>
              Merge {selectedTagsForMerge.length} tags into one. All selected tags will be replaced with the target tag name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selected Tags</Label>
              <div className="flex flex-wrap gap-2">
                {selectedTagsForMerge.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="merge-target">Target Tag Name</Label>
              <Input id="merge-target" value={mergeTargetTag} onChange={e => setMergeTargetTag(e.target.value)} placeholder="Enter target tag name" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMergeConfirm} disabled={!mergeTargetTag}>
              Merge Tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canManageMembers && <InviteTeamMemberDialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen} onInviteSent={() => {
      fetchTeamData();
      setIsInviteDialogOpen(false);
    }} />}
    </div>;
};
export default TeamPage;
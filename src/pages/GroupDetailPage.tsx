import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { useGroupMembers } from "@/hooks/useGroupMembers";
import { useGroupAttendance } from "@/hooks/useGroupAttendance";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Users, Calendar, Settings, UserPlus, MoreVertical, Edit, Trash2, CheckCircle2, User, UserCheck, Share2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddGroupMemberDialog } from "@/components/groups/AddGroupMemberDialog";
import { EditGroupDialog } from "@/components/groups/EditGroupDialog";
import { CreateMeetingDialog } from "@/components/groups/CreateMeetingDialog";
import { TakeAttendanceDialog } from "@/components/groups/TakeAttendanceDialog";
import { SignupRequestsDialog } from "@/components/groups/SignupRequestsDialog";
import { useGroupSignupRequests } from "@/hooks/useGroupSignupRequests";
import { GroupAvatar } from "@/components/groups/GroupAvatar";

const groupTypeLabels: Record<string, string> = {
  small_group: "Small Group",
  serving_team: "Serving Team",
  class: "Class",
  ministry: "Ministry",
};

const GroupDetailPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: group, isLoading: groupsLoading } = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select(`*, group_campuses(campus_id)`)
        .eq("id", groupId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const campus_ids: string[] = (data.group_campuses || [])
        .map((gc: any) => gc.campus_id)
        .filter(Boolean);
      return { ...data, campus_ids };
    },
    enabled: !!groupId,
    initialData: () => {
      const cachedGroups = queryClient.getQueriesData<any[]>({ queryKey: ["groups"] });
      return cachedGroups
        .flatMap(([, groups]) => groups || [])
        .find((cachedGroup) => cachedGroup.id === groupId);
    },
    staleTime: 5 * 60 * 1000,
  });
  const { members, isLoading: membersLoading, updateMember, removeMember } = useGroupMembers(groupId);
  const { meetings, meetingsLoading } = useGroupAttendance(groupId);

  // Per-meeting attendance summary
  const meetingIds = meetings.map((m) => m.id);
  const { data: attendanceByMeeting = {} } = useQuery({
    queryKey: ["group-attendance-summary", groupId, meetingIds.join(",")],
    queryFn: async () => {
      if (meetingIds.length === 0) return {} as Record<string, { present: number; absent: number; total: number }>;
      const { data, error } = await supabase
        .from("group_attendance")
        .select("group_meeting_id, status")
        .in("group_meeting_id", meetingIds);
      if (error) throw error;
      const map: Record<string, { present: number; absent: number; total: number }> = {};
      for (const r of data || []) {
        const id = r.group_meeting_id as string;
        if (!map[id]) map[id] = { present: 0, absent: 0, total: 0 };
        map[id].total += 1;
        if (r.status === "present") map[id].present += 1;
        else map[id].absent += 1;
      }
      return map;
    },
    enabled: meetingIds.length > 0,
  });


  const { toast } = useToast();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [createMeetingOpen, setCreateMeetingOpen] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [signupRequestsOpen, setSignupRequestsOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const copySignupLink = async () => {
    if (!group?.public_signup_token) return;
    const link = `${window.location.origin}/groups/join/${group.public_signup_token}`;
    
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      toast({
        title: "Link copied!",
        description: "Public signup link copied to clipboard",
      });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const { pendingCount } = useGroupSignupRequests(groupId);

  const existingMemberIds = members.map((m) => m.contact_id);


  const { data: leaderProfile } = useQuery({
    queryKey: ["leader-profile", group?.leader_user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", group!.leader_user_id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!group?.leader_user_id,
  });

  if (groupsLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-center py-12">
          <p>Loading group...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-center py-12">
          <h3 className="text-xl font-semibold mb-2">Group not found</h3>
          <Button onClick={() => navigate("/groups")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Groups
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => navigate("/groups")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        {/* Hero Banner */}
        <Card className="overflow-hidden">
          <div className="relative w-full aspect-video bg-muted overflow-hidden">
            {group.image_url ? (
              <>
                <img
                  src={group.image_url}
                  alt={group.name}
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50"
                />
                <img
                  src={group.image_url}
                  alt={group.name}
                  className="relative z-10 w-full h-full object-contain"
                />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-5xl font-semibold text-muted-foreground">
                  {group.name.trim().split(/\s+/).length >= 2
                    ? (group.name.trim().split(/\s+/)[0][0] + group.name.trim().split(/\s+/)[1][0]).toUpperCase()
                    : group.name.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <Badge variant="secondary" className="mb-2">
                  {group.pco_group_type_name?.split(":")[0].trim() ||
                    groupTypeLabels[group.group_type]}
                </Badge>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight break-words">
                  {group.name}
                </h1>
                {group.description && (
                  <p className="text-sm sm:text-base text-muted-foreground mt-2 mb-2 whitespace-pre-line break-words">
                    {group.description.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim()}
                  </p>
                )}
                {leaderProfile && (
                  <div className="flex items-center gap-2 mt-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={leaderProfile.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">{leaderProfile.full_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">Led by {leaderProfile.full_name}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {group.allow_public_signup && group.public_signup_token && (
                  <Button variant="outline" size="icon" onClick={copySignupLink} title="Share signup link">
                    {linkCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                  </Button>
                )}
                {group.allow_public_signup && (
                  <Button variant="outline" size="sm" onClick={() => setSignupRequestsOpen(true)} className="relative">
                    <UserCheck className="h-4 w-4 mr-2" />
                    Requests
                    {pendingCount > 0 && (
                      <Badge className="ml-2 h-5 min-w-5 flex items-center justify-center p-0 text-xs">
                        {pendingCount}
                      </Badge>
                    )}
                  </Button>
                )}
                <Button variant="outline" size="icon" onClick={() => setEditGroupOpen(true)} title="Edit group">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

        </Card>

        {/* Group Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {group.member_count || 0}
                {group.capacity && <span className="text-sm font-normal text-muted-foreground"> / {group.capacity}</span>}
              </div>
            </CardContent>
          </Card>

          {group.meeting_day && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Meeting Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {group.meeting_day}
                  {group.meeting_time && <span className="text-sm font-normal"> at {group.meeting_time}</span>}
                </div>
                {group.meeting_frequency && (
                  <p className="text-sm text-muted-foreground mt-1">{group.meeting_frequency}</p>
                )}
              </CardContent>
            </Card>
          )}

          {group.location && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Location</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{group.location}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabs for Members and Meetings */}
        <Tabs defaultValue="members" className="w-full">
          <TabsList>
            <TabsTrigger value="members">
              <Users className="h-4 w-4 mr-2" />
              Members
            </TabsTrigger>
            <TabsTrigger value="meetings">
              <Calendar className="h-4 w-4 mr-2" />
              Meetings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Group Members</h2>
              <Button size="sm" onClick={() => setAddMemberOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </div>

            {membersLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading members...</p>
              </div>
            ) : members.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No members yet</p>
                  <Button size="sm" className="mt-4" onClick={() => setAddMemberOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add First Member
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {members.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => navigate(`/contacts/${member.contact_id}`)}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.contact?.avatar || undefined} alt={member.contact?.name || "Member"} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {member.contact?.name
                              ? member.contact.name.trim().split(/\s+/).slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()
                              : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{member.contact?.name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.role} • Joined {new Date(member.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge variant="secondary">{member.status}</Badge>
                          {member.attendance_count > 0 && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {member.attendance_count} meetings attended
                            </p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/contacts/${member.contact_id}`)}>
                              <User className="h-4 w-4 mr-2" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                const newRole = member.role === "leader" ? "member" : "leader";
                                await updateMember.mutateAsync({
                                  id: member.id,
                                  updates: { role: newRole },
                                });
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Change to {member.role === "leader" ? "Member" : "Leader"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setMemberToRemove(member.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove from Group
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="meetings" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Group Meetings</h2>
              <Button size="sm" onClick={() => setCreateMeetingOpen(true)}>
                <Calendar className="h-4 w-4 mr-2" />
                Create Meeting
              </Button>
            </div>

            {meetingsLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading meetings...</p>
              </div>
            ) : meetings.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No meetings scheduled yet</p>
                  <Button size="sm" className="mt-4" onClick={() => setCreateMeetingOpen(true)}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Create First Meeting
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {(() => {
                  const completed = meetings
                    .filter((m) => new Date(m.meeting_date) <= new Date())
                    .slice(0, 8)
                    .map((m) => ({ m, att: attendanceByMeeting[m.id] }))
                    .filter((x) => x.att && x.att.total > 0);
                  if (completed.length === 0) return null;
                  const avgPresent = Math.round(
                    completed.reduce((s, x) => s + x.att!.present, 0) / completed.length
                  );
                  const avgTotal = Math.round(
                    completed.reduce((s, x) => s + x.att!.total, 0) / completed.length
                  );
                  const avgPct = avgTotal ? Math.round((avgPresent / avgTotal) * 100) : 0;
                  const last = completed[0];
                  const lastPct = last.att!.total ? Math.round((last.att!.present / last.att!.total) * 100) : 0;
                  const trend = [...completed].reverse();
                  return (
                    <Card>
                      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg attendance</p>
                          <p className="text-2xl font-bold">
                            {avgPresent} / {avgTotal}
                            <span className="text-sm font-normal text-muted-foreground ml-2">({avgPct}%)</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">last {completed.length} meetings</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Last meeting</p>
                          <p className="text-2xl font-bold">
                            {last.att!.present} / {last.att!.total}
                            <span className="text-sm font-normal text-muted-foreground ml-2">({lastPct}%)</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(last.m.meeting_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Trend</p>
                          <div className="flex items-end gap-1 h-12">
                            {trend.map((x) => {
                              const pct = x.att!.total ? (x.att!.present / x.att!.total) * 100 : 0;
                              return (
                                <div
                                  key={x.m.id}
                                  className="flex-1 bg-primary/70 rounded-sm min-h-[2px]"
                                  style={{ height: `${Math.max(pct, 4)}%` }}
                                  title={`${new Date(x.m.meeting_date).toLocaleDateString()}: ${x.att!.present}/${x.att!.total}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                <div className="grid gap-4">
                  {meetings.map((meeting) => {
                    const att = attendanceByMeeting[meeting.id];
                    const pct = att && att.total ? Math.round((att.present / att.total) * 100) : null;
                    return (
                      <Card key={meeting.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <CardTitle>{meeting.title}</CardTitle>
                              <CardDescription>
                                {new Date(meeting.meeting_date).toLocaleDateString()} • {meeting.duration_minutes} min • {meeting.location || "No location"}
                              </CardDescription>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {att && att.total > 0 ? (
                                  <Badge variant="secondary">
                                    {att.present} / {att.total} present{pct !== null ? ` (${pct}%)` : ""}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground">
                                    Not recorded
                                  </Badge>
                                )}
                                {meeting.attendance_submitted && (
                                  <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                                    Submitted
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant={meeting.status === "completed" ? "secondary" : "default"}>
                                {meeting.status}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedMeeting(meeting);
                                  setAttendanceDialogOpen(true);
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Take Attendance
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        {meeting.description && (
                          <CardContent>
                            <p className="text-sm text-muted-foreground">{meeting.description}</p>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        {group && (
          <>
            <AddGroupMemberDialog
              groupId={groupId!}
              open={addMemberOpen}
              onOpenChange={setAddMemberOpen}
              existingMemberIds={existingMemberIds}
            />
            <EditGroupDialog
              group={group}
              open={editGroupOpen}
              onOpenChange={setEditGroupOpen}
            />
            <CreateMeetingDialog
              groupId={groupId!}
              groupLocation={group.location}
              open={createMeetingOpen}
              onOpenChange={setCreateMeetingOpen}
            />
            <SignupRequestsDialog
              groupId={groupId!}
              organizationId={group.organization_id}
              open={signupRequestsOpen}
              onOpenChange={setSignupRequestsOpen}
            />
          </>
        )}

        {selectedMeeting && (
          <TakeAttendanceDialog
            groupId={groupId!}
            meeting={selectedMeeting}
            open={attendanceDialogOpen}
            onOpenChange={setAttendanceDialogOpen}
          />
        )}

        {/* Remove Member Confirmation */}
        <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Member?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this member from the group? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (memberToRemove) {
                    await removeMember.mutateAsync(memberToRemove);
                    setMemberToRemove(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default GroupDetailPage;

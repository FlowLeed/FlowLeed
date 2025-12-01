import { useParams, useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useGroups } from "@/hooks/useGroups";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { useGroupAttendance } from "@/hooks/useGroupAttendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Calendar, Settings, UserPlus } from "lucide-react";

const groupTypeLabels: Record<string, string> = {
  small_group: "Small Group",
  serving_team: "Serving Team",
  class: "Class",
  ministry: "Ministry",
};

const GroupDetailPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { organization } = useProfile();
  const { groups, isLoading: groupsLoading } = useGroups(organization?.id);
  const { members, isLoading: membersLoading } = useGroupMembers(groupId);
  const { meetings, meetingsLoading } = useGroupAttendance(groupId);

  const group = groups.find((g) => g.id === groupId);

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/groups")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
                <Badge variant="secondary">{groupTypeLabels[group.group_type]}</Badge>
              </div>
              {group.description && (
                <p className="text-muted-foreground">{group.description}</p>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Edit Group
          </Button>
        </div>

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
              <Button size="sm">
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
                  <Button size="sm" className="mt-4">
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
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{member.contact?.name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.role} • Joined {new Date(member.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">{member.status}</Badge>
                        {member.attendance_count > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {member.attendance_count} meetings attended
                          </p>
                        )}
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
              <Button size="sm">
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
                  <Button size="sm" className="mt-4">
                    <Calendar className="h-4 w-4 mr-2" />
                    Create First Meeting
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {meetings.map((meeting) => (
                  <Card key={meeting.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{meeting.title}</CardTitle>
                          <CardDescription>
                            {new Date(meeting.meeting_date).toLocaleDateString()} • {meeting.location || "No location"}
                          </CardDescription>
                        </div>
                        <Badge variant={meeting.status === "completed" ? "secondary" : "default"}>
                          {meeting.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    {meeting.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{meeting.description}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default GroupDetailPage;

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGroupMembers, GroupMember } from "@/hooks/useGroupMembers";
import { useGroupAttendance, GroupMeeting } from "@/hooks/useGroupAttendance";
import { useAuth } from "@/hooks/useAuth";
import { Check, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface TakeAttendanceDialogProps {
  groupId: string;
  meeting: GroupMeeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AttendanceState {
  [memberId: string]: boolean;
}

export const TakeAttendanceDialog = ({
  groupId,
  meeting,
  open,
  onOpenChange,
}: TakeAttendanceDialogProps) => {
  const { user } = useAuth();
  const { members } = useGroupMembers(groupId);
  const { recordAttendance } = useGroupAttendance(groupId);
  const [attendance, setAttendance] = useState<AttendanceState>({});
  const [saving, setSaving] = useState(false);

  // Fetch existing attendance records
  const { data: existingAttendance } = useQuery({
    queryKey: ["attendance", meeting.id],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("group_attendance")
        .select("group_member_id, status")
        .eq("group_meeting_id", meeting.id);
      return data || [];
    },
    enabled: open,
  });

  // Initialize attendance state from existing records
  useEffect(() => {
    if (existingAttendance && members) {
      const state: AttendanceState = {};
      members.forEach((member) => {
        const record = existingAttendance.find((a) => a.group_member_id === member.id);
        state[member.id] = record?.status === "present";
      });
      setAttendance(state);
    }
  }, [existingAttendance, members]);

  const handleToggle = (memberId: string) => {
    setAttendance((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  const handleMarkAllPresent = () => {
    const allPresent: AttendanceState = {};
    members.forEach((member) => {
      allPresent[member.id] = true;
    });
    setAttendance(allPresent);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Record attendance for each member
      const promises = members.map((member) => {
        return recordAttendance.mutateAsync({
          group_meeting_id: meeting.id,
          group_member_id: member.id,
          contact_id: member.contact_id,
          status: attendance[member.id] ? "present" : "absent",
          checked_in_by_user_id: user?.id,
        });
      });

      await Promise.all(promises);
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving attendance:", error);
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Take Attendance</DialogTitle>
          <DialogDescription>
            {meeting.title} • {new Date(meeting.meeting_date).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2 border-b">
          <div className="text-sm text-muted-foreground">
            {presentCount} of {members.length} present
          </div>
          <Button variant="outline" size="sm" onClick={handleMarkAllPresent}>
            <Check className="h-4 w-4 mr-2" />
            Mark All Present
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No members in this group</p>
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => handleToggle(member.id)}
              >
                <Checkbox
                  checked={attendance[member.id] || false}
                  onCheckedChange={() => handleToggle(member.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.contact?.avatar} />
                  <AvatarFallback>
                    {member.contact?.name?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{member.contact?.name || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground capitalize">{member.role}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Check className="h-4 w-4 mr-2" />
            Save Attendance
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

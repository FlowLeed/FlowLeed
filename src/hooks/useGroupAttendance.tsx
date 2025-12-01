import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface GroupMeeting {
  id: string;
  group_id: string;
  title: string;
  description?: string;
  meeting_date: string;
  duration_minutes: number;
  location?: string;
  meeting_type: string;
  status: string;
  notes?: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  group_meeting_id: string;
  group_member_id: string;
  contact_id: string;
  status: string;
  checked_in_at?: string;
  checked_in_by_user_id?: string;
  notes?: string;
  contact?: {
    name: string;
    avatar?: string;
  };
}

export const useGroupAttendance = (groupId: string | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: meetings, isLoading: meetingsLoading } = useQuery({
    queryKey: ["group-meetings", groupId],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await supabase
        .from("group_meetings")
        .select("*")
        .eq("group_id", groupId)
        .order("meeting_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  const getAttendanceForMeeting = (meetingId: string) =>
    useQuery({
      queryKey: ["attendance", meetingId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("group_attendance")
          .select(`
            *,
            contact:contacts(name, avatar)
          `)
          .eq("group_meeting_id", meetingId);

        if (error) throw error;
        return data;
      },
      enabled: !!meetingId,
    });

  const createMeeting = useMutation({
    mutationFn: async (newMeeting: Omit<GroupMeeting, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from("group_meetings")
        .insert([newMeeting])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-meetings"] });
      toast({
        title: "Meeting created",
        description: "The meeting has been scheduled.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating meeting",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const recordAttendance = useMutation({
    mutationFn: async (attendance: {
      group_meeting_id: string;
      group_member_id: string;
      contact_id: string;
      status: string;
      checked_in_by_user_id?: string;
    }) => {
      const { data, error } = await supabase
        .from("group_attendance")
        .upsert([{
          ...attendance,
          checked_in_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["group-members"] });
      toast({
        title: "Attendance recorded",
        description: "Attendance has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error recording attendance",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    meetings: meetings || [],
    meetingsLoading,
    getAttendanceForMeeting,
    createMeeting,
    recordAttendance,
  };
};

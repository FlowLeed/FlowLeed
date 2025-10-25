import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CallRecord {
  id: string;
  organization_id: string;
  contact_id: string;
  twilio_call_sid: string;
  from_number: string;
  to_number: string;
  direction: "inbound" | "outbound";
  status: string;
  call_type: "inbound" | "outbound" | "missed";
  duration: number | null;
  twilio_phone_number_id: string | null;
  initiated_by_user_id: string | null;
  recording_url: string | null;
  recording_sid: string | null;
  transcription: string | null;
  answered_at: string | null;
  ended_at: string | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CallWithContact extends CallRecord {
  contactName: string;
  contactAvatar?: string;
  contactRole?: string;
  phoneNumber?: string;
}

export const useCalls = () => {
  const queryClient = useQueryClient();
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_records")
        .select(
          `
          *,
          contacts (
            id,
            name,
            avatar,
            phone
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((call: any) => ({
        ...call,
        contactName: call.contacts?.name || "Unknown",
        contactAvatar: call.contacts?.avatar,
        phoneNumber: call.direction === "inbound" ? call.from_number : call.to_number,
      })) as CallWithContact[];
    },
  });

  const initiateCall = useMutation({
    mutationFn: async ({
      contactId,
      fromNumberId,
    }: {
      contactId: string;
      fromNumberId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "twilio-initiate-call",
        {
          body: { contactId, fromNumberId },
        }
      );

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      toast.success("Call initiated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to initiate call: ${error.message}`);
    },
  });

  // Subscribe to call updates
  const endCall = useMutation({
    mutationFn: async (callSid: string) => {
      const { data, error } = await supabase.functions.invoke(
        "twilio-end-call",
        {
          body: { callSid },
        }
      );

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      toast.success("Call ended");
    },
    onError: (error: Error) => {
      toast.error(`Failed to end call: ${error.message}`);
    },
  });

  // Subscribe to call updates
  const subscribeToCalls = (callback: (call: CallRecord) => void) => {
    const channel = supabase
      .channel("call_records")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_records",
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            callback(payload.new as CallRecord);
          }
          queryClient.invalidateQueries({ queryKey: ["calls"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return {
    calls,
    isLoading,
    initiateCall,
    subscribeToCalls,
    activeCallId,
    setActiveCallId,
    endCall,
  };
};
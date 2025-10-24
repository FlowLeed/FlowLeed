import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Conversation } from "@/types/messages";

export interface SMSMessage {
  id: string;
  organization_id: string;
  contact_id: string;
  twilio_message_sid: string;
  from_number: string;
  to_number: string;
  body: string;
  direction: "inbound" | "outbound";
  status: string;
  twilio_phone_number_id: string | null;
  sent_by_user_id: string | null;
  error_code: string | null;
  error_message: string | null;
  media_urls: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const useMessages = (contactId?: string) => {
  const queryClient = useQueryClient();

  // Get all conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery(
    {
      queryKey: ["conversations"],
      queryFn: async () => {
        // Get all contacts with messages
        const { data: messages, error } = await supabase
          .from("sms_messages")
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

        // Group by contact and get latest message
        const conversationsMap = new Map<string, Conversation>();

        messages?.forEach((msg: any) => {
          const contact = msg.contacts;
          if (!contact) return;

          const existing = conversationsMap.get(contact.id);
          if (!existing || new Date(msg.created_at) > existing.lastMessageTime) {
            conversationsMap.set(contact.id, {
              id: msg.id,
              contactId: contact.id,
              contactName: contact.name,
              contactAvatar: contact.avatar,
              contactPhone: contact.phone,
              lastMessage: msg.body,
              lastMessageTime: new Date(msg.created_at),
              unreadCount: msg.direction === "inbound" ? 1 : 0,
            });
          }
        });

        return Array.from(conversationsMap.values()).sort(
          (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
        );
      },
    }
  );

  // Get messages for a specific contact
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", contactId],
    queryFn: async () => {
      if (!contactId) return [];

      const { data, error } = await supabase
        .from("sms_messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as SMSMessage[];
    },
    enabled: !!contactId,
  });

  const sendMessage = useMutation({
    mutationFn: async ({
      contactId,
      body,
      fromNumberId,
    }: {
      contactId: string;
      body: string;
      fromNumberId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("twilio-send-sms", {
        body: { contactId, body, fromNumberId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["messages", variables.contactId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to send message: ${error.message}`);
    },
  });

  // Subscribe to new messages
  const subscribeToMessages = (callback: (message: SMSMessage) => void) => {
    const channel = supabase
      .channel("sms_messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sms_messages",
        },
        (payload) => {
          callback(payload.new as SMSMessage);
          queryClient.invalidateQueries({ queryKey: ["messages"] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return {
    conversations,
    conversationsLoading,
    messages,
    messagesLoading,
    sendMessage,
    subscribeToMessages,
  };
};
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ChatConversationSummary = {
  id: string;
  title: string | null;
  first_message: string | null;
  updated_at: string;
};

export const useChatHistory = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("chat_conversations")
        .select("id, title, messages, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (data) {
        setConversations(
          data.map((c: any) => {
            const msgs = c.messages as any[];
            const firstUserMsg = msgs?.find((m: any) => m.role === "user");
            return {
              id: c.id,
              title: c.title,
              first_message: firstUserMsg?.content?.slice(0, 80) || null,
              updated_at: c.updated_at,
            };
          })
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const deleteConversation = useCallback(async (id: string) => {
    await supabase.from("chat_conversations").delete().eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { conversations, isLoading, fetchConversations, deleteConversation };
};

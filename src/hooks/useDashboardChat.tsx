import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard-ai-chat`;
const TITLE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-chat-title`;
const ACTIVE_CONV_KEY = "flowleed:active-conversation-id";

export const useDashboardChat = () => {
  const { user } = useAuth();
  const { organization } = useProfile();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(
    typeof window !== "undefined" ? sessionStorage.getItem(ACTIVE_CONV_KEY) : null
  );
  const abortRef = useRef<AbortController | null>(null);
  const titleGeneratedRef = useRef(false);


  const saveConversation = useCallback(async (msgs: ChatMessage[], convId: string | null) => {
    if (!user?.id || !organization?.id) return convId;

    if (!convId) {
      // Create new conversation
      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({
          user_id: user.id,
          organization_id: organization.id,
          messages: msgs as any,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Failed to create conversation:", error);
        return null;
      }
      return data.id;
    } else {
      // Update existing
      await supabase
        .from("chat_conversations")
        .update({ messages: msgs as any })
        .eq("id", convId);
      return convId;
    }
  }, [user?.id, organization?.id]);

  const generateTitle = useCallback(async (convId: string, msgs: ChatMessage[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch(TITLE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ conversation_id: convId, messages: msgs }),
      });
    } catch (e) {
      console.error("Title generation failed:", e);
    }
  }, []);

  const sendMessage = useCallback(async (input: string) => {
    const userMsg: ChatMessage = { role: "user", content: input };
    const allMessages = [...messages, userMsg];
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = "";
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in to use the AI assistant.");
        setIsLoading(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: allMessages }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        const errorMsg = errorData.error || `Error ${resp.status}`;
        toast.error(errorMsg);
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const snapshot = assistantSoFar;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: snapshot } : m));
                }
                return [...prev, { role: "assistant", content: snapshot }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const snapshot = assistantSoFar;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: snapshot } : m));
                }
                return [...prev, { role: "assistant", content: snapshot }];
              });
            }
          } catch { /* ignore */ }
        }
      }

      // Save to DB after stream completes
      if (assistantSoFar) {
        const finalMessages = [...allMessages, { role: "assistant" as const, content: assistantSoFar }];
        const savedId = await saveConversation(finalMessages, conversationId);
        if (savedId) {
          setConversationId(savedId);
          // Auto-title on first exchange
          if (!titleGeneratedRef.current && finalMessages.length >= 2) {
            titleGeneratedRef.current = true;
            generateTitle(savedId, finalMessages);
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error("Chat error:", e);
        toast.error("Failed to get AI response. Please try again.");
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [messages, conversationId, saveConversation, generateTitle]);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    sessionStorage.removeItem(ACTIVE_CONV_KEY);
    titleGeneratedRef.current = false;
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, messages, title")
      .eq("id", id)
      .single();

    if (data) {
      const msgs = (data.messages as any[]) || [];
      setMessages(msgs);
      setConversationId(data.id);
      titleGeneratedRef.current = !!data.title;
    }
  }, []);

  // Keep the active conversation across navigation (e.g. opening a person's profile)
  useEffect(() => {
    if (conversationId) sessionStorage.setItem(ACTIVE_CONV_KEY, conversationId);
  }, [conversationId]);

  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !user?.id) return;
    const saved = sessionStorage.getItem(ACTIVE_CONV_KEY);
    if (!saved || messages.length > 0) return;
    restoredRef.current = true;
    loadConversation(saved);
  }, [user?.id, messages.length, loadConversation]);

  return { messages, isLoading, sendMessage, cancelStream, clearChat, conversationId, loadConversation };
};


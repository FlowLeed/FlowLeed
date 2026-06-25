import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatTimestamp } from "@/lib/contentUtils";

interface Citation {
  id: number;
  chunk_id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  channel_name: string | null;
  start_seconds: number;
  snippet: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

interface Props {
  organizationId: string;
  videoId?: string;
}

export const ContentChat = ({ organizationId, videoId }: Props) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  const send = async () => {
    const message = input.trim();
    if (!message || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const projectRef = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectRef}.supabase.co/functions/v1/content-chat`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message, organizationId, videoId, sessionId: sessionIdRef.current,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Chat failed (${res.status})`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let leftover = "";
      let citations: Citation[] | undefined;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        leftover += dec.decode(value, { stream: true });
        const lines = leftover.split("\n");
        leftover = lines.pop() ?? "";

        let event = "message";
        for (const raw of lines) {
          if (raw.startsWith("event:")) { event = raw.slice(6).trim(); continue; }
          if (!raw.startsWith("data:")) continue;
          const payload = raw.slice(5).trim();
          if (payload === "[DONE]") continue;

          if (event === "meta") {
            try {
              const meta = JSON.parse(payload);
              sessionIdRef.current = meta.sessionId;
              citations = meta.citations;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { ...copy[copy.length - 1], citations };
                return copy;
              });
            } catch { /* ignore */ }
            event = "message";
            continue;
          }
          try {
            const j = JSON.parse(payload);
            const delta = j.choices?.[0]?.delta?.content;
            if (delta) {
              setMessages((m) => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                copy[copy.length - 1] = { ...last, content: last.content + delta };
                return copy;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: `Error: ${e?.message ?? String(e)}` };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="max-h-[60vh] space-y-4 overflow-y-auto overflow-x-hidden">
        {messages.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">
            Ask anything about {videoId ? "this video" : "your video library"}. Answers cite the exact moments.
          </Card>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={`max-w-[92%] rounded-lg p-3 sm:max-w-[85%] ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              <div className="whitespace-pre-wrap text-sm">{m.content || (streaming ? "…" : "")}</div>
              {m.citations && m.citations.length > 0 && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {m.citations.map((c) => (
                    <Link
                      key={c.chunk_id}
                      to={`/content/videos/${c.video_id}?t=${c.start_seconds}`}
                      className="flex min-w-0 gap-2 rounded border bg-background p-2 transition-shadow hover:shadow-sm"
                    >
                      {c.thumbnail_url && (
                         <img src={c.thumbnail_url} alt="" className="h-14 w-14 flex-shrink-0 rounded object-cover sm:h-16 sm:w-16" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">[{c.id}] {c.title}</div>
                        <div className="text-[10px] text-muted-foreground">{formatTimestamp(c.start_seconds)}</div>
                        <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{c.snippet}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          disabled={streaming}
          className="h-11"
        />
        <Button type="submit" disabled={streaming || !input.trim()} className="h-11">
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
};

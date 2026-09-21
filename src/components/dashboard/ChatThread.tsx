import React, { useRef, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { type ChatMessage } from "@/hooks/useDashboardChat";
import { User, Sparkles, RotateCcw, History, ListPlus, ShieldCheck, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BulkAddToFlowDialog } from "@/components/contacts/BulkAddToFlowDialog";

const THINKING_MESSAGES = [
  "Looking at the whole picture...",
  "Connecting what we know...",
  "Looking for what matters most...",
  "Checking the details...",
  "Thinking about what might need attention...",
  "Making sure nothing important gets missed...",
  "Turning signals into something useful...",
  "Considering the next best step...",
  "Keeping people at the center...",
  "Almost there...",
];

/** Rotating, human-centered status lines shown while FlowLeed AI thinks. */
const ThinkingStatus = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % THINKING_MESSAGES.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <p key={THINKING_MESSAGES[index]} className="animate-fade-in text-sm font-light text-muted-foreground tracking-wide">
      {THINKING_MESSAGES[index]}
    </p>
  );
};


interface ChatThreadProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onClear: () => void;
  onOpenHistory?: () => void;
  onConfirmAction?: (actionRequestId: string) => Promise<{ ok: boolean; message: string }>;
}

export const ChatThread: React.FC<ChatThreadProps> = ({ messages, isLoading, onClear, onOpenHistory, onConfirmAction }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [bulkIds, setBulkIds] = useState<string[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [handledActions, setHandledActions] = useState<Set<string>>(new Set());

  // Confirmation cards live inside saved messages, so a reopened conversation would show
  // them again. Look up what actually happened to each request instead of trusting the text.
  const actionIds = useMemo(() => {
    const ids: string[] = [];
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      for (const found of msg.content.matchAll(/<!--flowleed:action=({.*?})-->/g)) {
        try {
          const parsed = JSON.parse(found[1]);
          if (parsed?.id) ids.push(parsed.id as string);
        } catch { /* ignore */ }
      }
    }
    return ids;
  }, [messages]);

  const { data: actionStates } = useQuery({
    queryKey: ["ai-action-requests", actionIds],
    enabled: actionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_action_requests")
        .select("id, status, expires_at")
        .in("id", actionIds);
      if (error) throw error;
      return new Map((data ?? []).map((row: any) => [row.id as string, row]));
    },
  });



  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const markdownComponents = useMemo(() => ({
    p: ({ children }: any) => <p className="font-sans text-sm font-normal">{children}</p>,
    a: ({ href, children, ...props }: any) => {
      const isInternal = href?.startsWith("/");
      // Only link to a person when the id looks like a real record id; the
      // assistant must never send us to a made-up profile.
      const isPersonLink = /^\/contacts\/[0-9a-fA-F-]{36}$/.test(href || "");
      const isBrokenPerson = href?.startsWith("/contacts/") && !isPersonLink;
      if (isBrokenPerson) {
        return <span className="font-medium">{children}</span>;
      }
      if (isInternal) {
        return (
          <button
            className="text-primary font-medium underline underline-offset-2 hover:text-primary/80 transition-colors cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              navigate(href);
            }}
            {...props}
          >
            {children}
          </button>
        );
      }

      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline" {...props}>
          {children}
        </a>
      );
    },
  }), [navigate]);

  if (messages.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 mt-6">
      <div className="flex justify-end gap-1 mb-2">
        {onOpenHistory && (
          <Button variant="ghost" size="sm" onClick={onOpenHistory} className="text-xs text-muted-foreground gap-1.5">
            <History className="h-3 w-3" />
            History
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClear} className="text-xs text-muted-foreground gap-1.5">
          <RotateCcw className="h-3 w-3" />
          New conversation
        </Button>
      </div>
      {messages.map((msg, i) => (
        <div key={i} className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          {msg.role === "assistant" && (
            <div className="flex-shrink-0 mt-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary" aria-label="FlowLeed AI">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
          )}
          <div
            className={`
              rounded-2xl px-3.5 py-3 sm:px-5 sm:py-4 max-w-[92%] sm:max-w-[85%] text-base leading-relaxed min-w-0
              ${msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-transparent rounded-bl-md"
              }
            `}
          >
            {msg.role === "assistant" ? (
              (() => {
                // Extract hidden contact-ids marker emitted by find_contacts_by_criteria
                const match = msg.content.match(/<!--flowleed:contact_ids=(\[[^\]]*\])-->/);
                let contactIds: string[] = [];
                if (match) {
                  try { contactIds = JSON.parse(match[1]); } catch { /* ignore */ }
                }
                const cleanContent = msg.content.replace(/<!--flowleed:contact_ids=\[[^\]]*\]-->\s*/g, "").trimEnd();
                const actionMatch = cleanContent.match(/<!--flowleed:action=({.*?})-->/);
                let action: { id: string; type?: string; summary: string; expires_at: string } | null = null;
                if (actionMatch) {
                  try { action = JSON.parse(actionMatch[1]); } catch { /* ignore */ }
                }
                const visibleContent = cleanContent.replace(/<!--flowleed:action={.*?}-->\s*/g, "").trimEnd();
                return (
                  <div className="prose prose-base dark:prose-invert max-w-none
                    [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                    [&_p+p]:mt-3
                    prose-headings:font-semibold prose-headings:text-foreground
                    prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3
                    prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2
                    prose-p:mb-3 prose-p:leading-6
                    prose-ul:my-3 prose-ol:my-3
                    prose-li:my-1 prose-li:leading-6
                    prose-strong:text-foreground
                    [&_p_strong:first-child]:inline-block [&_p_strong:first-child]:mt-2
                  ">
                    <ReactMarkdown components={markdownComponents}>{visibleContent}</ReactMarkdown>
                    {contactIds.length > 0 && (
                      <div className="not-prose mt-4 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => setBulkIds(contactIds)} className="gap-2">
                          <ListPlus className="h-4 w-4" />
                          Review {contactIds.length} {contactIds.length === 1 ? "person" : "people"}
                        </Button>
                      </div>
                    )}
                    {action && !handledActions.has(action.id) && (
                      <div className="not-prose mt-4 rounded-md border bg-muted/30 p-4">
                         <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-medium">{action.type === "create_contact_note" ? "Confirm new note" : action.type === "create_prayer_request" ? "Confirm prayer request" : "Confirm Flow change"}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{action.summary}</p></div></div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button size="sm" disabled={confirmingId === action.id || new Date(action.expires_at).getTime() <= Date.now()} onClick={async () => { if (!onConfirmAction || !action) return; setConfirmingId(action.id); const result = await onConfirmAction(action.id); setConfirmingId(null); if (result.ok) setHandledActions((current) => new Set(current).add(action.id)); }}>
                             {confirmingId === action.id ? "Confirming..." : action.type === "create_contact_note" ? "Save note" : action.type === "create_prayer_request" ? "Save prayer request" : "Confirm add"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setHandledActions((current) => new Set(current).add(action.id))}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <p className="whitespace-pre-wrap">
                {(() => {
                  // Strip the "[Referenced contacts: ...]" context block from display
                  const display = msg.content
                    .replace(/\n*\[Referenced contacts:[^\]]*\]\s*$/i, "")
                    .trimEnd();
                  // Bold @mentions
                  const parts = display.split(/(@\p{Lu}[\p{L}\p{M}\-\.']*(?:\s\p{Lu}[\p{L}\p{M}\-\.']*){0,2})/gu);
                  return parts.map((part, idx) =>
                    part.startsWith("@") ? (
                      <strong key={idx} className="font-semibold">{part}</strong>
                    ) : (
                      <span key={idx}>{part}</span>
                    )
                  );
                })()}
              </p>
            )}
          </div>
          {msg.role === "user" && (
            <div className="flex-shrink-0 mt-1">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            </div>
          )}
        </div>
      ))}
      {isLoading && messages[messages.length - 1]?.role === "user" && (
        <div className="flex gap-3 justify-start">
          <div className="flex-shrink-0 mt-1">
            <div className="flex h-7 w-7 animate-pulse items-center justify-center rounded-md bg-primary" aria-label="FlowLeed AI">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
          <div className="rounded-2xl rounded-bl-md px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <ThinkingStatus />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
      {bulkIds && bulkIds.length > 0 && (
        <BulkAddToFlowDialog
          open={!!bulkIds}
          onOpenChange={(o) => { if (!o) setBulkIds(null); }}
          contactIds={bulkIds}
          reviewFirst
          onSuccess={() => setBulkIds(null)}
        />
      )}
    </div>
  );
};

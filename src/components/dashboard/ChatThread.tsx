import { Link } from "react-router-dom";
import React, { useRef, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ChatMessage } from "@/hooks/useDashboardChat";
import { User, HeartHandshake, RotateCcw, History, ListPlus, ShieldCheck, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BulkAddToFlowDialog } from "@/components/contacts/BulkAddToFlowDialog";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";

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

/** Words that mark a section title rather than body text. */
const TITLE_HINT =
  /\b(?:Overview|Activity|History|Summary|Context|Connection|Engagement|Household|Groups?|Flows?|Journey|Milestones?|Profile|Serving|Family|Care|Spiritual|Recent|Leadership|Next Steps|Prayer|Notes|Demographics|Tags|Interactions)\b/;

const formatAssistantMarkdown = (content: string) => {
  let text = content
    // Preserve markdown structure when a streamed heading arrives immediately
    // after the previous sentence.
    .replace(/([^\n])(?=#{2,3}\s)/g, "$1\n\n")
    // A bold-only line is a section title, not body text.
    .replace(/^[ \t]*\*\*([^*]+)\*\*[ \t]*$/gm, (_m, t: string) => `### ${t.trim().replace(/:$/, "")}\n\n`)
    // A bold title at the start of a line becomes a quiet heading; ordinary
    // emphasized words just lose their bold so paragraphs stay plain.
    .replace(/^([ \t]*)\*\*([^*]+?)\*\*[ \t]*/gm, (_m, sp: string, inner: string) => {
      const title = inner.trim().replace(/:$/, "");
      if (/:$/.test(inner.trim()) || TITLE_HINT.test(title)) {
        return `${sp}### ${title}\n\n`;
      }
      return `${sp}${inner.trim()} `;
    })
    // Mid-line bold labels start their own quiet heading between paragraphs.
    .replace(/([^\n*])\s*\*\*([^*]{1,60}?):\*\*(?=\s*\S)/g, (_m, before: string, label: string) =>
      `${before}\n\n### ${label.trim()}\n\n`);
  // Bold stays for titles only - paragraphs render as plain text.
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  return text
    .replace(/(#{2,3} [^\n]+\n\n)[ \t]+/g, "$1")
    // A heading glued to its first sentence ("Private NoteA private...").
    .replace(/^(#{2,3} [^\n]*?[a-z])([A-Z][a-z])/gm, "$1\n\n$2")
    // Keep person links readable when glued to a preceding word.
    .replace(/(\S)(?=\[)/g, "$1 ")
    // Repair common sentence boundaries lost by upstream streaming.
    .replace(/([.!?])(?=[A-Z])/g, "$1 ")
    .replace(/([:;])(?=[A-Z])/g, "$1 ")
    // Repair common profile section headings joined to their first sentence.
    .replace(/^(#{2,3}\s+.*(?:Overview|Activity|History|Summary|Context|Connections|Engagement|Household|Groups|Flows|Next Steps))(?=[A-Z])/gm, "$1\n\n");
};

/** In-app links (like /contacts/...) open inside FlowLeed, not as external sites. */
const ChatLink = ({ href, children }: { href?: string; children?: React.ReactNode }) => {
  if (href && href.startsWith("/")) return <Link to={href}>{children}</Link>;
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
};

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

interface ActionRequestState {
  id: string;
  status: string;
  expires_at: string;
}

export const ChatThread: React.FC<ChatThreadProps> = ({ messages, isLoading, onClear, onOpenHistory, onConfirmAction }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
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
      return new Map((data ?? []).map((row) => {
        const state = row as ActionRequestState;
        return [state.id, state] as const;
      }));
    },
  });



  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        <Message key={i} from={msg.role} className={`flex-row gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          {msg.role === "assistant" && (
            <div className="flex-shrink-0 mt-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary" aria-label="FlowLeed AI">
                <HeartHandshake className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
          )}
          <MessageContent
            className={`
              max-w-[92%] min-w-0 text-[15px] leading-7 sm:max-w-[85%] sm:text-base
              ${msg.role === "user"
                ? "rounded-2xl rounded-br-md bg-primary px-3.5 py-3 text-primary-foreground sm:px-5 sm:py-4"
                : "bg-transparent px-0 py-1"
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
                type ChatAction = { id: string; type?: string; summary: string; expires_at: string };
                const actionsAll: ChatAction[] = [];
                for (const m of cleanContent.matchAll(/<!--flowleed:action=(\{.*?\})-->/g)) {
                  try {
                    const a = JSON.parse(m[1]) as ChatAction;
                    if (a?.id && !actionsAll.some((x) => x.id === a.id)) actionsAll.push(a);
                  } catch { /* ignore */ }
                }
                const visibleContent = cleanContent.replace(/<!--flowleed:[\s\S]*?-->\s*/g, "").trimEnd();
                return (
                  <div className="max-w-none">
                    <MessageResponse linkSafety={{ enabled: false }} components={{ a: ChatLink }} className="font-sans text-sm font-normal leading-6
                      [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                      [&_p]:my-0 [&_p+p]:mt-4
                      [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:leading-6
                      [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:leading-6
                      [&_ul]:my-3 [&_ol]:my-3 [&_li]:my-1 [&_li]:leading-6
                      [&_strong]:font-semibold [&_strong]:text-foreground
                      [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
                      {formatAssistantMarkdown(visibleContent)}
                    </MessageResponse>
                    {contactIds.length > 0 && (
                      <div className="not-prose mt-4 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => setBulkIds(contactIds)} className="gap-2">
                          <ListPlus className="h-4 w-4" />
                          Review {contactIds.length} {contactIds.length === 1 ? "person" : "people"}
                        </Button>
                      </div>
                    )}
                    {actionsAll.filter((action) => !handledActions.has(action.id)).map((action) => (<div key={action.id}>{(() => {
                      const state = actionStates?.get(action.id) as { status?: string; expires_at?: string } | undefined;
                      const status = state?.status;
                      const expiresAt = state?.expires_at ?? action.expires_at;
                      const expired = new Date(expiresAt).getTime() <= Date.now();
                      const title = action.type === "create_contact_note" ? "note" : action.type === "create_prayer_request" ? "prayer request" : action.type === "create_task" ? "task" : "Flow change";

                      if (status === "completed") {
                        return (
                          <div className="not-prose mt-4 flex items-start gap-3 rounded-md border bg-muted/30 p-4 text-sm">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                            <p>This {title} was already saved.</p>
                          </div>
                        );
                      }

                      if (status === "cancelled" || status === "failed" || expired) {
                        return (
                          <div className="not-prose mt-4 flex items-start gap-3 rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                            <Clock className="mt-0.5 h-5 w-5" />
                            <p>
                              {status === "failed"
                                ? `This ${title} could not be saved. Ask FlowLeed AI again to try once more.`
                                : `This ${title} is no longer waiting for you. Ask FlowLeed AI again if you still want it.`}
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="not-prose mt-4 rounded-md border bg-muted/30 p-4">
                           <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-medium">{action.type === "create_contact_note" ? "Confirm new note" : action.type === "create_prayer_request" ? "Confirm prayer request" : action.type === "create_task" ? "Confirm new task" : "Confirm Flow change"}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{action.summary}</p></div></div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" disabled={confirmingId === action.id} onClick={async () => { if (!onConfirmAction) return; setConfirmingId(action.id); const result = await onConfirmAction(action.id); setConfirmingId(null); if (result.ok) setHandledActions((current) => new Set(current).add(action.id)); }}>
                               {confirmingId === action.id ? "Confirming..." : action.type === "create_contact_note" ? "Save note" : action.type === "create_prayer_request" ? "Save prayer request" : action.type === "create_task" ? "Save task" : "Confirm add"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setHandledActions((current) => new Set(current).add(action.id))}>Cancel</Button>
                          </div>
                        </div>
                      );
                    })()}</div>))}
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
                  const parts = display.split(/(@\p{Lu}[\p{L}\p{M}.'-]*(?:\s\p{Lu}[\p{L}\p{M}.'-]*){0,2})/gu);
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
          </MessageContent>
          {msg.role === "user" && (
            <div className="flex-shrink-0 mt-1">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            </div>
          )}
        </Message>
      ))}
      {isLoading && messages[messages.length - 1]?.role === "user" && (
        <div className="flex gap-3 justify-start">
          <div className="flex-shrink-0 mt-1">
            <div className="flex h-7 w-7 animate-pulse items-center justify-center rounded-md bg-primary" aria-label="FlowLeed AI">
              <HeartHandshake className="h-4 w-4 text-primary-foreground" />
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

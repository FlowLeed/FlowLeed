import React, { useRef, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { type ChatMessage } from "@/hooks/useDashboardChat";
import { User, Sparkles, RotateCcw, History, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkAddToFlowDialog } from "@/components/contacts/BulkAddToFlowDialog";


interface ChatThreadProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onClear: () => void;
  onOpenHistory?: () => void;
}

export const ChatThread: React.FC<ChatThreadProps> = ({ messages, isLoading, onClear, onOpenHistory }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [bulkIds, setBulkIds] = useState<string[] | null>(null);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const markdownComponents = useMemo(() => ({
    p: ({ children }: any) => <p className="font-sans font-thin text-sm">{children}</p>,
    a: ({ href, children, ...props }: any) => {
      const isInternal = href?.startsWith("/");
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
        <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          {msg.role === "assistant" && (
            <div className="flex-shrink-0 mt-1">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
          )}
          <div
            className={`
              rounded-2xl px-5 py-4 max-w-[85%] text-base leading-relaxed
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
                return (
                  <div className="prose prose-base dark:prose-invert max-w-none
                    [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                    [&_p+p]:mt-6
                    prose-headings:font-semibold prose-headings:text-foreground
                    prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-4
                    prose-h3:text-base prose-h3:mt-7 prose-h3:mb-3
                    prose-p:mb-6 prose-p:leading-8
                    prose-ul:my-4 prose-ol:my-4
                    prose-li:my-1.5
                    prose-strong:text-foreground
                    [&_p_strong:first-child]:inline-block [&_p_strong:first-child]:mt-2
                  ">
                    <ReactMarkdown components={markdownComponents}>{cleanContent}</ReactMarkdown>
                    {contactIds.length > 0 && (
                      <div className="not-prose mt-4 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => setBulkIds(contactIds)} className="gap-2">
                          <ListPlus className="h-4 w-4" />
                          Add {contactIds.length} {contactIds.length === 1 ? "person" : "people"} to a Flow
                        </Button>
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
                      <React.Fragment key={idx}>{part}</React.Fragment>
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
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            </div>
          </div>
          <div className="rounded-2xl rounded-bl-md px-5 py-4">
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

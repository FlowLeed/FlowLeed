import React, { useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { type ChatMessage } from "@/hooks/useDashboardChat";
import { User, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatThreadProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onClear: () => void;
}

export const ChatThread: React.FC<ChatThreadProps> = ({ messages, isLoading, onClear }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleLinkClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("/flows/") || href.startsWith("/contacts/")) {
      e.preventDefault();
      navigate(href);
    }
  }, [navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 mt-6">
      <div className="flex justify-end mb-2">
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
              rounded-2xl px-4 py-3 max-w-[85%] text-base leading-relaxed
              ${msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-muted/50 rounded-bl-md"
              }
            `}
          >
            {msg.role === "assistant" ? (
              <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:my-4 prose-li:my-1 prose-headings:mt-8 prose-headings:mb-4 [&_p+p]:mt-5">="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:my-4 prose-li:my-1 prose-headings:mt-8 prose-headings:mb-4 [&_p+p]:mt-5"> max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:my-4 prose-li:my-1.5 prose-headings:mt-8 prose-headings:mb-4 [&_p+p]:mt-5">">
                <ReactMarkdown
                  components={{
                    a: ({ href, children, ...props }) => (
                      <a
                        href={href}
                        onClick={(e) => href && handleLinkClick(e, href)}
                        className="text-primary hover:underline cursor-pointer font-medium"
                        {...props}
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{msg.content}</p>
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
          <div className="rounded-2xl rounded-bl-md bg-muted/50 px-4 py-3">
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

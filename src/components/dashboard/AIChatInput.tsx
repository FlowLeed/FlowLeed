import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Send, Square, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

interface AIChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  onCancel: () => void;
  hasMessages: boolean;
}

interface MentionContact {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
}

interface Mention {
  id: string;
  name: string;
}

export const AIChatInput: React.FC<AIChatInputProps> = ({ onSubmit, isLoading, onCancel, hasMessages }) => {
  const [input, setInput] = useState("");
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionContact[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const triggerStartRef = useRef<number | null>(null);
  const { organization } = useProfile();

  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading]);

  // Debounced search
  useEffect(() => {
    if (mentionQuery === null || !organization?.id) {
      setMentionResults([]);
      return;
    }
    const q = mentionQuery.trim();
    const timeout = setTimeout(async () => {
      try {
        const { data, error } = await (supabase as any).rpc("search_visible_contacts", {
          _organization_id: organization.id,
          _search_term: q || "",
          _limit: 6,
        });
        if (error) throw error;
        setMentionResults((data || []) as MentionContact[]);
        setActiveIndex(0);
      } catch (e) {
        console.warn("Mention search failed", e);
        setMentionResults([]);
      }
    }, 150);
    return () => clearTimeout(timeout);
  }, [mentionQuery, organization?.id]);

  const detectMention = useCallback((value: string, caret: number) => {
    // Look back from caret for an '@' not preceded by a word char and not followed by whitespace
    let i = caret - 1;
    while (i >= 0) {
      const ch = value[i];
      if (ch === "@") {
        const prev = i > 0 ? value[i - 1] : " ";
        if (/\s|^/.test(prev) || i === 0) {
          const fragment = value.slice(i + 1, caret);
          if (/^[\w\-\.]*$/.test(fragment)) {
            triggerStartRef.current = i;
            setMentionQuery(fragment);
            return;
          }
        }
        break;
      }
      if (/\s/.test(ch)) break;
      i--;
    }
    triggerStartRef.current = null;
    setMentionQuery(null);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    const caret = e.target.selectionStart ?? value.length;
    detectMention(value, caret);
  };

  const insertMention = (contact: MentionContact) => {
    const start = triggerStartRef.current;
    if (start === null || !textareaRef.current) return;
    const el = textareaRef.current;
    const caret = el.selectionStart ?? input.length;
    const before = input.slice(0, start);
    const after = input.slice(caret);
    const token = `@${contact.name}`;
    const next = `${before}${token} ${after}`;
    setInput(next);
    setMentions((prev) => {
      // dedupe by id
      if (prev.some((m) => m.id === contact.id)) return prev;
      return [...prev, { id: contact.id, name: contact.name }];
    });
    setMentionQuery(null);
    triggerStartRef.current = null;
    // restore caret after inserted token + space
    requestAnimationFrame(() => {
      const pos = before.length + token.length + 1;
      el.focus();
      el.setSelectionRange(pos, pos);
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    });
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    // Filter mentions to those still present in the text
    const activeMentions = mentions.filter((m) => trimmed.includes(`@${m.name}`));
    let payload = trimmed;
    if (activeMentions.length > 0) {
      const context = activeMentions
        .map((m) => `${m.name} (contact_id: ${m.id})`)
        .join("; ");
      payload = `${trimmed}\n\n[Referenced contacts: ${context}]`;
    }
    onSubmit(payload);
    setInput("");
    setMentions([]);
    setMentionQuery(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const dropdownOpen = mentionQuery !== null && mentionResults.length > 0;
    if (dropdownOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % mentionResults.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionResults[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  };

  const dropdownOpen = mentionQuery !== null && mentionResults.length > 0;

  return (
    <div className={`relative w-full ${hasMessages ? "max-w-3xl" : "max-w-2xl"} mx-auto`}>
      <div className="relative rounded-2xl border-2 border-border bg-card shadow-lg transition-all focus-within:border-primary/50 focus-within:shadow-xl focus-within:shadow-primary/5">
        <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">FlowLeed AI</span>
          <span className="text-[10px] text-muted-foreground/60 ml-1">· type @ to mention a person</span>
        </div>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
          placeholder="Ask about your people, tasks, church health..."
          rows={2}
          className="w-full resize-none bg-transparent px-4 py-2 text-base md:text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none"
          disabled={isLoading}
        />
        <div className="flex items-center justify-end px-3 pb-3">
          {isLoading ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={onCancel}
              className="rounded-xl gap-1.5"
            >
              <Square className="h-3 w-3" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="rounded-xl gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          )}
        </div>

        {dropdownOpen && (
          <div className="absolute left-3 bottom-full mb-2 z-50 w-72 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
              People
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {mentionResults.map((c, idx) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(c);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      idx === activeIndex ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={c.avatar || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{c.name}</div>
                      {c.email && (
                        <div className="truncate text-xs text-muted-foreground">{c.email}</div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

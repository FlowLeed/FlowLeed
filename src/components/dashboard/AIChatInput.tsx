// ============= Full file contents =============

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, Square, Plus, Mic, X, Check, Loader2 } from "lucide-react";
import { recordWav, type WavRecording } from "@/lib/recordWav";
import { transcribeAudio } from "@/lib/transcribeAudio";

const MAX_RECORDING_SECONDS = 120;
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
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recordingRef = useRef<WavRecording | null>(null);
  const timerRef = useRef<number | null>(null);
  const finishRecordingRef = useRef<() => void>(() => {});

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
    // Look back from caret for the nearest '@' preceded by start-of-string or whitespace.
    // Allow spaces inside the query so users can type "First Last".
    let atIndex = -1;
    for (let i = caret - 1; i >= 0; i--) {
      const ch = value[i];
      if (ch === "\n") break;
      if (ch === "@") {
        const prev = i > 0 ? value[i - 1] : " ";
        if (i === 0 || /\s/.test(prev)) {
          atIndex = i;
        }
        break;
      }
    }
    if (atIndex === -1) {
      triggerStartRef.current = null;
      setMentionQuery(null);
      return;
    }
    const fragment = value.slice(atIndex + 1, caret);
    // Reject if too long, contains name-ending punctuation, newline, or more than 2 spaces.
    const spaceCount = (fragment.match(/ /g) || []).length;
    const valid =
      fragment.length <= 40 &&
      spaceCount <= 2 &&
      !/[\n,.!?;:]/.test(fragment) &&
      /^[\w\-\. ]*$/.test(fragment);
    if (!valid) {
      triggerStartRef.current = null;
      setMentionQuery(null);
      return;
    }
    triggerStartRef.current = atIndex;
    setMentionQuery(fragment);
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

  // "+" opens the people picker: inserts a real "@" at the caret so the
  // existing mention detection takes over naturally.
  const handlePlusClick = () => {
    const el = textareaRef.current;
    if (!el || voiceState !== "idle") return;
    el.focus();
    const pos = el.selectionStart ?? input.length;
    const before = input.slice(0, pos);
    const after = input.slice(pos);
    setInput(`${before}@${after}`);
    triggerStartRef.current = pos;
    setMentionQuery("");
    requestAnimationFrame(() => {
      el.setSelectionRange(pos + 1, pos + 1);
    });
  };

  // ---- Voice input: record → transcribe → send automatically ----
  const clearTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const startRecording = async () => {
    setVoiceError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      recordingRef.current = await recordWav();
      setElapsed(0);
      setVoiceState("recording");
      const started = Date.now();
      timerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - started) / 1000);
        setElapsed(secs);
        if (secs >= MAX_RECORDING_SECONDS) finishRecordingRef.current();
      }, 250);
    } catch (e: any) {
      const denied = e?.name === "NotAllowedError" || e?.name === "SecurityError";
      setVoiceError(denied
        ? "Microphone access is blocked. Allow it in your browser settings to record."
        : "Couldn't start the microphone. Please try again.");
    }
  };

  const cancelRecording = () => {
    clearTimer();
    recordingRef.current?.cancel();
    recordingRef.current = null;
    setVoiceState("idle");
  };

  const finishRecording = async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    clearTimer();
    setVoiceState("transcribing");
    const base = input.trim() ? input.trimEnd() + " " : "";
    try {
      const file = await rec.stop();
      const text = await transcribeAudio(file, (partial) => setInput(base + partial));
      const finalText = (base + text).trim();
      if (finalText && !isLoading) {
        // Voice transcription is sent straight away — no review step.
        onSubmit(finalText);
        setInput("");
        setMentions([]);
        setMentionQuery(null);
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      } else {
        setVoiceError("I couldn't hear anything. Please try again.");
      }
    } catch (e: any) {
      setInput(base.trimEnd());
      setVoiceError(e?.message || "Transcription failed. Please try again.");
    } finally {
      setVoiceState("idle");
    }
  };
  finishRecordingRef.current = finishRecording;

  useEffect(() => () => { clearTimer(); recordingRef.current?.cancel(); }, []);

  const dropdownOpen = mentionQuery !== null && mentionResults.length > 0;

  const iconBtn =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none";

  return (
    <div className={`relative w-full ${hasMessages ? "max-w-3xl" : "max-w-2xl"} mx-auto`}>
      <div className="relative rounded-full border border-border bg-card shadow-lg shadow-black/5 transition-all focus-within:border-primary/40 focus-within:shadow-xl focus-within:shadow-primary/5">
        <div className="flex items-center gap-1 py-1.5 pl-1.5 pr-1.5">
          {voiceState === "recording" ? (
            <>
              <div className="flex min-w-0 flex-1 items-center gap-2 pl-3 text-xs text-muted-foreground">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
                </span>
                <span className="font-medium tabular-nums text-foreground">
                  {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                </span>
                <span className="hidden truncate sm:inline">Listening…</span>
              </div>
              <button
                type="button"
                onClick={cancelRecording}
                className={iconBtn}
                aria-label="Cancel recording"
                title="Cancel recording"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                onClick={finishRecording}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
                aria-label="Done recording"
                title="Done recording"
              >
                <Check className="h-[18px] w-[18px]" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePlusClick}
                className={iconBtn}
                aria-label="Mention a person"
                title="Mention a person"
                disabled={isLoading}
              >
                <Plus className="h-5 w-5" />
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
                placeholder="Message"
                rows={1}
                disabled={isLoading}
                className="min-h-9 max-h-32 w-full flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-6 placeholder:text-muted-foreground/70 focus:outline-none"
              />
              <div className="flex shrink-0 items-center gap-1">
                {isLoading ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive text-white transition-colors hover:bg-destructive/90"
                    aria-label="Stop generating"
                    title="Stop generating"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={voiceState === "transcribing"}
                      className={iconBtn}
                      aria-label="Record a voice message"
                      title="Record a voice message"
                    >
                      {voiceState === "transcribing"
                        ? <Loader2 className="h-[18px] w-[18px] animate-spin" />
                        : <Mic className="h-[18px] w-[18px]" />}
                    </button>
                    {input.trim() && (
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!input.trim() || voiceState === "transcribing"}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
                        aria-label="Send message"
                        title="Send message"
                      >
                        <ArrowUp className="h-[18px] w-[18px]" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {dropdownOpen && textareaRef.current && (() => {
          const rect = textareaRef.current.getBoundingClientRect();
          const dropdownWidth = Math.min(288, window.innerWidth - 24);
          const maxHeight = Math.min(240, Math.max(120, rect.top - 16));
          const left = Math.min(rect.left, window.innerWidth - dropdownWidth - 8);
          return createPortal(
            <div
              style={{
                position: "fixed",
                left,
                top: rect.top - 8,
                transform: "translateY(-100%)",
                width: dropdownWidth,
                maxHeight,
              }}
              className="z-[100] rounded-xl border border-border bg-popover shadow-xl overflow-hidden flex flex-col"
            >
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border shrink-0 flex items-center justify-between gap-2">
                <span>People</span>
                {mentionQuery && mentionQuery.includes(" ") && (
                  <span className="normal-case tracking-normal text-[10px] text-muted-foreground/70">
                    Keep typing · Esc to cancel
                  </span>
                )}
              </div>
              <ul className="overflow-y-auto py-1 flex-1">
                {mentionResults.map((c, idx) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertMention(c);
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                        className={`w-full min-h-11 flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
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
            </div>,
            document.body
          );
        })()}
      </div>
      {voiceError && (
        <div className="mt-1.5 px-2 text-xs text-destructive">{voiceError}</div>
      )}
    </div>
  );
};

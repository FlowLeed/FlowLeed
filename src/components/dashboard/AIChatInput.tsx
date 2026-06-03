import React, { useState, useRef, useEffect } from "react";
import { Send, Square, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AIChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  onCancel: () => void;
  hasMessages: boolean;
}

export const AIChatInput: React.FC<AIChatInputProps> = ({ onSubmit, isLoading, onCancel, hasMessages }) => {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
    setInput("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

  return (
    <div className={`relative w-full ${hasMessages ? "max-w-3xl" : "max-w-2xl"} mx-auto`}>
      <div className="relative rounded-2xl border-2 border-border bg-card shadow-lg transition-all focus-within:border-primary/50 focus-within:shadow-xl focus-within:shadow-primary/5">
        <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">FlowLeed AI</span>
        </div>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
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
      </div>
    </div>
  );
};

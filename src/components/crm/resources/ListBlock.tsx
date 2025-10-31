import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

interface ListBlockProps {
  content: string;
  ordered?: boolean;
  onChange: (content: string) => void;
  onBackspaceAtStart?: () => void;
  onEnter?: () => void;
  autoFocus?: boolean;
}

export const ListBlock = ({
  content,
  ordered = false,
  onChange,
  onBackspaceAtStart,
  onEnter,
  autoFocus,
}: ListBlockProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;

    if (e.key === "Backspace" && target.selectionStart === 0 && target.selectionEnd === 0) {
      e.preventDefault();
      onBackspaceAtStart?.();
    }

    if (e.key === "Enter" && !e.shiftKey) {
      // Get the current line content
      const cursorPos = target.selectionStart;
      const textBeforeCursor = target.value.substring(0, cursorPos);
      const currentLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
      const currentLine = target.value.substring(currentLineStart, cursorPos);
      
      // Only exit list (create new block) if current line is empty
      if (currentLine.trim() === '') {
        e.preventDefault();
        onEnter?.();
      }
      // Otherwise allow default Enter behavior to add new line (new list item)
    }
  };

  const ListTag = ordered ? "ol" : "ul";
  const items = content.split("\n").filter(item => item.trim());

  return (
    <div className="space-y-2">
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={ordered ? "Type numbered list items (one per line)" : "Type bullet list items (one per line)"}
        className="min-h-[100px] resize-none border-0 focus-visible:ring-0 shadow-none p-2 text-base leading-relaxed"
        rows={Math.max(4, items.length + 1)}
      />
    </div>
  );
};

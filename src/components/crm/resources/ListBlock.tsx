import { Input } from "@/components/ui/input";
import { useEffect, useRef } from "react";

interface ListBlockProps {
  content: string;
  ordered?: boolean;
  onChange: (content: string) => void;
  onBackspaceAtStart?: () => void;
  onEnter?: () => void;
  onEnterContinueList?: () => void;
  autoFocus?: boolean;
}

export const ListBlock = ({
  content,
  ordered = false,
  onChange,
  onBackspaceAtStart,
  onEnter,
  onEnterContinueList,
  autoFocus,
}: ListBlockProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(
        inputRef.current.value.length,
        inputRef.current.value.length
      );
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.currentTarget;

    if (e.key === "Backspace" && target.selectionStart === 0 && target.selectionEnd === 0) {
      e.preventDefault();
      onBackspaceAtStart?.();
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (content.trim() === '') {
        // Empty line - convert to paragraph
        onEnter?.();
      } else {
        // Has content - add new list item
        onEnterContinueList?.();
      }
    }
  };

  return (
    <div className="flex gap-3 items-center">
      {/* List marker */}
      <div className="flex-shrink-0 text-muted-foreground text-base">
        {ordered ? '1.' : '•'}
      </div>
      
      {/* Text input */}
      <Input
        ref={inputRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={ordered ? "List item" : "List item"}
        className="border-0 focus-visible:ring-0 shadow-none px-0 h-auto py-1 text-base"
      />
    </div>
  );
};

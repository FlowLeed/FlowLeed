import { Block } from "@/types/resources";
import { useRef, useLayoutEffect } from "react";

interface ParagraphBlockProps {
  block: Block;
  isEditing: boolean;
  onChange?: (content: string) => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  onBackspaceAtStart?: () => void;
}

export const ParagraphBlock = ({ block, isEditing, onChange, onFocus, autoFocus, onBackspaceAtStart }: ParagraphBlockProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  useLayoutEffect(() => {
    if (textareaRef.current && isEditing) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [block.content, isEditing]);
  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={block.content}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.key === 'Backspace') {
            const target = e.target as HTMLTextAreaElement;
            if (target.selectionStart === 0 && target.selectionEnd === 0) {
              e.preventDefault();
              onBackspaceAtStart?.();
            }
          }
        }}
        className="w-full bg-transparent border-none outline-none focus:ring-0 p-0 resize-none min-h-[24px] leading-relaxed text-[15px] placeholder:text-muted-foreground/50"
        placeholder="Type '/' for commands, or just start writing..."
        rows={1}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = target.scrollHeight + 'px';
        }}
      />
    );
  }

  if (!block.content) {
    return null;
  }

  return (
    <p className="text-foreground whitespace-pre-wrap leading-relaxed text-[15px]">
      {block.content}
    </p>
  );
};

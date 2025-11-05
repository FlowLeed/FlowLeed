import { Block } from "@/types/resources";
import { cn } from "@/lib/utils";

interface HeadingBlockProps {
  block: Block;
  isEditing: boolean;
  onChange?: (content: string) => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  onBackspaceAtStart?: () => void;
}

export const HeadingBlock = ({ block, isEditing, onChange, onFocus, autoFocus, onBackspaceAtStart }: HeadingBlockProps) => {
  const level = block.level || 1;
  
  const headingClasses = cn(
    "font-bold leading-tight",
    level === 1 && "text-4xl mt-4 mb-2",
    level === 2 && "text-3xl mt-3 mb-2",
    level === 3 && "text-2xl mt-2 mb-1"
  );

  if (isEditing) {
    return (
      <textarea
        value={block.content}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onFocus}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === 'Backspace') {
            const target = e.target as HTMLTextAreaElement;
            if (target.selectionStart === 0 && target.selectionEnd === 0) {
              e.preventDefault();
              onBackspaceAtStart?.();
            }
          }
        }}
        rows={1}
        className={cn(
          headingClasses,
          "w-full bg-transparent border-none outline-none focus:ring-0 p-0 placeholder:text-muted-foreground/50 resize-none overflow-hidden"
        )}
        placeholder={`Heading ${level}`}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = target.scrollHeight + 'px';
        }}
      />
    );
  }

  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  
  return (
    <Tag className={cn(headingClasses, "break-words")}>
      {block.content || `Heading ${level}`}
    </Tag>
  );
};

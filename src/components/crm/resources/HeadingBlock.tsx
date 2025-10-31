import { Block } from "@/types/resources";
import { cn } from "@/lib/utils";

interface HeadingBlockProps {
  block: Block;
  isEditing: boolean;
  onChange?: (content: string) => void;
  onFocus?: () => void;
  autoFocus?: boolean;
}

export const HeadingBlock = ({ block, isEditing, onChange, onFocus, autoFocus }: HeadingBlockProps) => {
  const level = block.level || 1;
  
  const headingClasses = cn(
    "font-bold leading-tight",
    level === 1 && "text-4xl mt-4 mb-2",
    level === 2 && "text-3xl mt-3 mb-2",
    level === 3 && "text-2xl mt-2 mb-1"
  );

  if (isEditing) {
    return (
      <input
        type="text"
        value={block.content}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onFocus}
        autoFocus={autoFocus}
        className={cn(
          headingClasses,
          "w-full bg-transparent border-none outline-none focus:ring-0 p-0 placeholder:text-muted-foreground/50"
        )}
        placeholder={`Heading ${level}`}
      />
    );
  }

  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  
  return (
    <Tag className={headingClasses}>
      {block.content || `Heading ${level}`}
    </Tag>
  );
};

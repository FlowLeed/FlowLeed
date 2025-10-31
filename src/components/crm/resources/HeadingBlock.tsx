import { Block } from "@/types/resources";
import { cn } from "@/lib/utils";

interface HeadingBlockProps {
  block: Block;
  isEditing: boolean;
  onChange?: (content: string) => void;
}

export const HeadingBlock = ({ block, isEditing, onChange }: HeadingBlockProps) => {
  const level = block.level || 1;
  
  const headingClasses = cn(
    "font-semibold",
    level === 1 && "text-3xl",
    level === 2 && "text-2xl",
    level === 3 && "text-xl"
  );

  if (isEditing) {
    return (
      <input
        type="text"
        value={block.content}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          headingClasses,
          "w-full bg-transparent border-none outline-none focus:ring-0 p-0"
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

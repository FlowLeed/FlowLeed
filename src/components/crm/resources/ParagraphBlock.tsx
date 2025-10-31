import { Block } from "@/types/resources";

interface ParagraphBlockProps {
  block: Block;
  isEditing: boolean;
  onChange?: (content: string) => void;
}

export const ParagraphBlock = ({ block, isEditing, onChange }: ParagraphBlockProps) => {
  if (isEditing) {
    return (
      <textarea
        value={block.content}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full bg-transparent border-none outline-none focus:ring-0 p-0 resize-none min-h-[24px]"
        placeholder="Type something..."
        rows={1}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = target.scrollHeight + 'px';
        }}
      />
    );
  }

  return (
    <p className="text-foreground whitespace-pre-wrap">
      {block.content || "Empty paragraph"}
    </p>
  );
};

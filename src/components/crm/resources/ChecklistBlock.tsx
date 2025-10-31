import { Block } from "@/types/resources";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface ChecklistBlockProps {
  block: Block;
  isEditing: boolean;
  onChange?: (content: string, checked?: boolean) => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  onBackspaceAtStart?: () => void;
}

export const ChecklistBlock = ({ block, isEditing, onChange, onFocus, autoFocus, onBackspaceAtStart }: ChecklistBlockProps) => {
  return (
    <div 
      className="flex items-start gap-3 cursor-pointer group/checklist"
      onClick={(e) => {
        if (!isEditing && e.target === e.currentTarget) {
          onChange?.(block.content, !block.checked);
        }
      }}
    >
      <Checkbox
        checked={block.checked || false}
        onCheckedChange={(checked) => onChange?.(block.content, checked as boolean)}
        disabled={!isEditing}
        className="mt-0.5 rounded"
      />
      {isEditing ? (
        <input
          type="text"
          value={block.content}
          onChange={(e) => onChange?.(e.target.value, block.checked)}
          onFocus={onFocus}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              const target = e.target as HTMLInputElement;
              if (target.selectionStart === 0 && target.selectionEnd === 0) {
                e.preventDefault();
                onBackspaceAtStart?.();
              }
            }
          }}
          className="flex-1 bg-transparent border-none outline-none focus:ring-0 p-0 text-[15px] placeholder:text-muted-foreground/50"
          placeholder="To-do item..."
        />
      ) : (
        <span 
          className={cn(
            "flex-1 text-[15px] transition-all",
            block.checked && "line-through text-muted-foreground/70"
          )}
        >
          {block.content || "To-do item"}
        </span>
      )}
    </div>
  );
};

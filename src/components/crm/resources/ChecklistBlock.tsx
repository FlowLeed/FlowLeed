import { Block } from "@/types/resources";
import { Checkbox } from "@/components/ui/checkbox";

interface ChecklistBlockProps {
  block: Block;
  isEditing: boolean;
  onChange?: (content: string, checked?: boolean) => void;
}

export const ChecklistBlock = ({ block, isEditing, onChange }: ChecklistBlockProps) => {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        checked={block.checked || false}
        onCheckedChange={(checked) => onChange?.(block.content, checked as boolean)}
        disabled={!isEditing}
        className="mt-1"
      />
      {isEditing ? (
        <input
          type="text"
          value={block.content}
          onChange={(e) => onChange?.(e.target.value, block.checked)}
          className="flex-1 bg-transparent border-none outline-none focus:ring-0 p-0"
          placeholder="Checklist item..."
        />
      ) : (
        <span className={block.checked ? "line-through text-muted-foreground" : ""}>
          {block.content || "Checklist item"}
        </span>
      )}
    </div>
  );
};

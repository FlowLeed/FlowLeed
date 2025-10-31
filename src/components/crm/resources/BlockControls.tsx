import { Grip, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BlockControlsProps {
  onDelete: () => void;
  onDuplicate?: () => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}

export const BlockControls = ({
  onDelete,
  onDuplicate,
  isDragging,
  dragHandleProps,
}: BlockControlsProps) => {
  return (
    <div
      className={cn(
        "absolute left-0 top-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity -ml-12",
        isDragging && "opacity-100"
      )}
    >
      <div
        {...dragHandleProps}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded"
      >
        <Grip className="h-4 w-4 text-muted-foreground" />
      </div>
      {onDuplicate && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDuplicate}
          className="h-6 w-6 hover:bg-accent"
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-6 w-6 hover:bg-destructive/10"
      >
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
};

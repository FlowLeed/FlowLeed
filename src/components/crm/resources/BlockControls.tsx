import { Grip, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
        "absolute left-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity -ml-10",
        isDragging && "opacity-100"
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded"
          >
            <Grip className="h-4 w-4 text-muted-foreground" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {onDuplicate && (
            <>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem 
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

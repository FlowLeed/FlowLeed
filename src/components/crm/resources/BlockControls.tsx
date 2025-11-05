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
import { useState } from "react";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [mouseDownPos, setMouseDownPos] = useState<{x: number, y: number} | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setMouseDownPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!mouseDownPos) return;
    
    const deltaX = Math.abs(e.clientX - mouseDownPos.x);
    const deltaY = Math.abs(e.clientY - mouseDownPos.y);
    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
    
    // If moved less than 5px, treat as click and open menu
    if (distance < 5) {
      setMenuOpen(true);
    }
    
    setMouseDownPos(null);
  };

  return (
    <div
      className={cn(
        "absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity -ml-10",
        (isDragging || menuOpen) && "opacity-100"
      )}
    >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <div
            {...dragHandleProps}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
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

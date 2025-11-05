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
  const [clickStart, setClickStart] = useState<{x: number, y: number, time: number} | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setClickStart({ x: e.clientX, y: e.clientY, time: Date.now() });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!clickStart) return;
    
    const deltaX = Math.abs(e.clientX - clickStart.x);
    const deltaY = Math.abs(e.clientY - clickStart.y);
    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
    const duration = Date.now() - clickStart.time;
    
    // If clicked quickly (<200ms) and didn't move much (<3px), open menu
    if (duration < 200 && distance < 3) {
      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(true);
    }
    
    setClickStart(null);
  };

  const handleMouseLeave = () => {
    // Cancel click detection if mouse leaves during potential drag
    setClickStart(null);
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
            onClick={handleClick}
            onMouseLeave={handleMouseLeave}
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

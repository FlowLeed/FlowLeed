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

  const handlePointerDown = (e: React.PointerEvent) => {
    setClickStart({ x: e.clientX, y: e.clientY, time: Date.now() });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!clickStart) return;
    
    const deltaX = Math.abs(e.clientX - clickStart.x);
    const deltaY = Math.abs(e.clientY - clickStart.y);
    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
    const duration = Date.now() - clickStart.time;
    
    // Only open menu if it's a quick click with minimal movement
    if (duration <= 200 && distance < 5) {
      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(true);
    }
    
    setClickStart(null);
  };

  const handlePointerCancel = () => {
    setClickStart(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(true);
  };

  return (
    <div
      className={cn(
        "absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity -ml-10 relative",
        (isDragging || menuOpen) && "opacity-100"
      )}
    >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          {/* Invisible anchor for positioning - does not receive pointer events */}
          <span className="absolute inset-0 pointer-events-none" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" sideOffset={8} className="w-48 z-50 bg-popover">
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

      {/* Actual interactive handle */}
      <div
        {...dragHandleProps}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
        onContextMenu={handleContextMenu}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded"
      >
        <Grip className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
};

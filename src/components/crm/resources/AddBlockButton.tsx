import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AddBlockButtonProps {
  onClick: () => void;
}

export const AddBlockButton = ({ onClick }: AddBlockButtonProps) => {
  return (
    <div className="group/add-block relative h-2 flex items-center justify-start opacity-0 hover:opacity-100 transition-opacity">
      <div className="absolute left-0 flex items-center gap-2 pl-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className="h-5 w-5 rounded hover:bg-accent"
        >
          <Plus className="h-3 w-3 text-muted-foreground" />
        </Button>
        <div className="h-px flex-1 bg-border w-16 opacity-50" />
      </div>
    </div>
  );
};

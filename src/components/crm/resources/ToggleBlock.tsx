import { Block } from "@/types/resources";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResourcesViewer } from "./ResourcesViewer";
import { ResourcesEditor } from "./ResourcesEditor";

interface ToggleBlockProps {
  block: Block;
  isEditing: boolean;
  onChange?: (content: string, collapsed?: boolean, children?: Block[]) => void;
}

export const ToggleBlock = ({ block, isEditing, onChange }: ToggleBlockProps) => {
  const isOpen = !block.collapsed;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(open) => onChange?.(block.content, !open, block.children)}
      className="space-y-1"
    >
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group/toggle hover:bg-accent/5 rounded px-1 -mx-1 transition-colors">
        <ChevronRight 
          className={cn(
            "h-4 w-4 transition-all duration-200 text-muted-foreground flex-shrink-0",
            isOpen && "rotate-90"
          )}
        />
        {isEditing ? (
          <input
            type="text"
            value={block.content}
            onChange={(e) => onChange?.(e.target.value, block.collapsed, block.children)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent border-none outline-none focus:ring-0 p-0 font-medium text-[15px] placeholder:text-muted-foreground/50"
            placeholder="Toggle heading..."
          />
        ) : (
          <span className="flex-1 font-medium text-[15px]">{block.content || "Toggle"}</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-6 space-y-1 border-l-2 border-accent/20 pl-3 transition-all duration-200">
        {isEditing ? (
          <ResourcesEditor
            blocks={block.children || []}
            onChange={(newChildren) => onChange?.(block.content, block.collapsed, newChildren)}
            isNested
          />
        ) : (
          <ResourcesViewer blocks={block.children || []} />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

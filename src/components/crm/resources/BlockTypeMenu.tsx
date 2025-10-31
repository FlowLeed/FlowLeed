import { BlockType } from "@/types/resources";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Heading1,
  Heading2,
  Heading3,
  Type,
  CheckSquare,
  ChevronRight,
  Minus,
} from "lucide-react";

interface BlockTypeMenuProps {
  onSelect: (type: BlockType, level?: number) => void;
  onClose: () => void;
  searchQuery?: string;
}

const blockTypes = [
  { type: 'heading' as BlockType, level: 1, icon: Heading1, label: 'Heading 1', shortcut: '⌘⌥1', description: 'Large section heading' },
  { type: 'heading' as BlockType, level: 2, icon: Heading2, label: 'Heading 2', shortcut: '⌘⌥2', description: 'Medium section heading' },
  { type: 'heading' as BlockType, level: 3, icon: Heading3, label: 'Heading 3', shortcut: '⌘⌥3', description: 'Small section heading' },
  { type: 'paragraph' as BlockType, icon: Type, label: 'Text', shortcut: '⌘⌥0', description: 'Plain text paragraph' },
  { type: 'checklist' as BlockType, icon: CheckSquare, label: 'To-do', shortcut: '⌘⌥4', description: 'Checklist item' },
  { type: 'toggle' as BlockType, icon: ChevronRight, label: 'Toggle', shortcut: '⌘⌥5', description: 'Collapsible section' },
  { type: 'divider' as BlockType, icon: Minus, label: 'Divider', shortcut: '⌘⌥-', description: 'Visual separator' },
];

export const BlockTypeMenu = ({ onSelect, onClose, searchQuery = '' }: BlockTypeMenuProps) => {
  const filteredBlocks = searchQuery
    ? blockTypes.filter(
        (block) =>
          block.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          block.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : blockTypes;

  return (
    <div className="absolute z-50 w-80 bg-popover border border-border rounded-md shadow-lg animate-in fade-in-0 zoom-in-95">
      <Command>
        <CommandInput placeholder="Search blocks..." />
        <CommandList>
          <CommandEmpty>No blocks found.</CommandEmpty>
          <CommandGroup heading="Basic Blocks">
            {filteredBlocks.map((block) => {
              const Icon = block.icon;
              return (
                <CommandItem
                  key={`${block.type}-${block.level || 0}`}
                  onSelect={() => {
                    onSelect(block.type, block.level);
                    onClose();
                  }}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">{block.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {block.description}
                    </div>
                  </div>
                  {block.shortcut && (
                    <kbd className="text-xs text-muted-foreground">
                      {block.shortcut}
                    </kbd>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
};

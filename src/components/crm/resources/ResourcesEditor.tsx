import { Block } from "@/types/resources";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, Trash2 } from "lucide-react";
import { HeadingBlock } from "./HeadingBlock";
import { ParagraphBlock } from "./ParagraphBlock";
import { DividerBlock } from "./DividerBlock";
import { ChecklistBlock } from "./ChecklistBlock";
import { ToggleBlock } from "./ToggleBlock";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface ResourcesEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  isNested?: boolean;
}

export const ResourcesEditor = ({ blocks, onChange, isNested = false }: ResourcesEditorProps) => {
  const addBlock = (type: Block['type'], index?: number) => {
    const newBlock: Block = {
      id: crypto.randomUUID(),
      type,
      content: '',
      ...(type === 'heading' && { level: 1 }),
      ...(type === 'checklist' && { checked: false }),
      ...(type === 'toggle' && { collapsed: false, children: [] }),
    };

    const insertIndex = index !== undefined ? index + 1 : blocks.length;
    const newBlocks = [...blocks];
    newBlocks.splice(insertIndex, 0, newBlock);
    onChange(newBlocks);
  };

  const updateBlock = (index: number, updates: Partial<Block>) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates };
    onChange(newBlocks);
  };

  const deleteBlock = (index: number) => {
    const newBlocks = blocks.filter((_, i) => i !== index);
    onChange(newBlocks);
  };

  return (
    <div className="space-y-2">
      {blocks.length === 0 && !isNested && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Start building your documentation</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addBlock('paragraph')}
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add your first block
          </Button>
        </div>
      )}

      {blocks.map((block, index) => (
        <div key={block.id} className="group relative">
          <div className="flex items-start gap-2">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => deleteBlock(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="flex-1 min-w-0">
              {block.type === 'heading' && (
                <HeadingBlock
                  block={block}
                  isEditing
                  onChange={(content) => updateBlock(index, { content })}
                />
              )}
              {block.type === 'paragraph' && (
                <ParagraphBlock
                  block={block}
                  isEditing
                  onChange={(content) => updateBlock(index, { content })}
                />
              )}
              {block.type === 'divider' && <DividerBlock />}
              {block.type === 'checklist' && (
                <ChecklistBlock
                  block={block}
                  isEditing
                  onChange={(content, checked) => updateBlock(index, { content, checked })}
                />
              )}
              {block.type === 'toggle' && (
                <ToggleBlock
                  block={block}
                  isEditing
                  onChange={(content, collapsed, children) => 
                    updateBlock(index, { content, collapsed, children })
                  }
                />
              )}
            </div>
          </div>

          {/* Add block menu */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-8 mt-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add block
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => addBlock('heading', index)}>
                  Heading
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock('paragraph', index)}>
                  Paragraph
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock('checklist', index)}>
                  Checklist
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock('toggle', index)}>
                  Toggle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock('divider', index)}>
                  Divider
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}

      {blocks.length > 0 && !isNested && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add block
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => addBlock('heading')}>
              Heading
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('paragraph')}>
              Paragraph
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('checklist')}>
              Checklist
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('toggle')}>
              Toggle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('divider')}>
              Divider
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

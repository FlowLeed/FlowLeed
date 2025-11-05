import { useState, useCallback } from "react";
import { Block, BlockType } from "@/types/resources";
import { HeadingBlock } from "./HeadingBlock";
import { ParagraphBlock } from "./ParagraphBlock";
import { DividerBlock } from "./DividerBlock";
import { ChecklistBlock } from "./ChecklistBlock";
import { ToggleBlock } from "./ToggleBlock";
import { BlockControls } from "./BlockControls";
import { AddBlockButton } from "./AddBlockButton";
import { BlockTypeMenu } from "./BlockTypeMenu";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import { cn } from "@/lib/utils";

interface ResourcesEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  isNested?: boolean;
}

export const ResourcesEditor = ({ blocks, onChange, isNested = false }: ResourcesEditorProps) => {
  const [focusedBlockIndex, setFocusedBlockIndex] = useState<number | null>(null);
  const [showMenuAtIndex, setShowMenuAtIndex] = useState<number | null>(null);
  const [slashCommandIndex, setSlashCommandIndex] = useState<number | null>(null);

  const addBlock = useCallback((type: BlockType, index?: number, level?: number) => {
    const newBlock: Block = {
      id: `block-${Date.now()}-${Math.random()}`,
      type,
      content: "",
      level: type === 'heading' ? (level || 1) : undefined,
      checked: type === 'checklist' ? false : undefined,
      collapsed: type === 'toggle' ? false : undefined,
      children: type === 'toggle' ? [] : undefined,
    };

    const newBlocks = [...blocks];
    const insertIndex = index !== undefined ? index : blocks.length;
    newBlocks.splice(insertIndex, 0, newBlock);
    onChange(newBlocks);
    setFocusedBlockIndex(insertIndex);
  }, [blocks, onChange]);

  const updateBlock = useCallback((index: number, updates: Partial<Block>) => {
    // Only update if content actually changed
    const currentBlock = blocks[index];
    const hasActualChange = Object.keys(updates).some(
      key => updates[key as keyof Block] !== currentBlock[key as keyof Block]
    );
    
    if (!hasActualChange) return;
    
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates };
    
    // Check for slash command
    if (updates.content !== undefined && typeof updates.content === 'string') {
      if (updates.content === '/' || updates.content.startsWith('/')) {
        setSlashCommandIndex(index);
      } else {
        setSlashCommandIndex(null);
      }
    }
    
    onChange(newBlocks);
  }, [blocks, onChange]);

  const deleteBlock = useCallback((index: number) => {
    const newBlocks = blocks.filter((_, i) => i !== index);
    onChange(newBlocks);
    // Focus previous block if available
    if (index > 0) {
      setFocusedBlockIndex(index - 1);
    }
  }, [blocks, onChange]);

  const duplicateBlock = useCallback((index: number) => {
    const blockToDuplicate = blocks[index];
    const duplicatedBlock: Block = {
      ...blockToDuplicate,
      id: `block-${Date.now()}-${Math.random()}`,
      children: blockToDuplicate.children ? 
        blockToDuplicate.children.map(child => ({
          ...child,
          id: `block-${Date.now()}-${Math.random()}`
        })) : undefined
    };
    
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, duplicatedBlock);
    onChange(newBlocks);
    setFocusedBlockIndex(index + 1);
  }, [blocks, onChange]);

  const moveBlock = useCallback((fromIndex: number, toIndex: number) => {
    const newBlocks = [...blocks];
    const [movedBlock] = newBlocks.splice(fromIndex, 1);
    newBlocks.splice(toIndex, 0, movedBlock);
    onChange(newBlocks);
  }, [blocks, onChange]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    moveBlock(result.source.index, result.destination.index);
  };

  const handleSlashCommandSelect = (type: BlockType, level?: number) => {
    if (slashCommandIndex !== null) {
      const newBlocks = [...blocks];
      newBlocks[slashCommandIndex] = {
        ...newBlocks[slashCommandIndex],
        type,
        content: "",
        level: type === 'heading' ? level : undefined,
        checked: type === 'checklist' ? false : undefined,
        collapsed: type === 'toggle' ? false : undefined,
        children: type === 'toggle' ? [] : undefined,
      };
      onChange(newBlocks);
      setSlashCommandIndex(null);
    }
  };

  const mergeWithPreviousBlock = useCallback((index: number) => {
    if (index === 0) return; // Can't merge if first block
    
    const currentBlock = blocks[index];
    const previousBlock = blocks[index - 1];
    
    // Case 1: Current block is empty - just delete it
    if (!currentBlock.content || currentBlock.content.trim() === '') {
      deleteBlock(index);
      return;
    }
    
    // Case 2: Previous block is a divider - delete previous, keep current
    if (previousBlock.type === 'divider') {
      deleteBlock(index - 1);
      return;
    }
    
    // Case 3: Previous block is a toggle - can't merge (complex nested structure)
    if (previousBlock.type === 'toggle') {
      // Just move cursor to end of previous block
      setFocusedBlockIndex(index - 1);
      return;
    }
    
    // Case 4: Standard merge - append current content to previous
    const mergedContent = previousBlock.content + currentBlock.content;
    const cursorPosition = previousBlock.content.length; // Save for cursor placement
    
    const newBlocks = [...blocks];
    newBlocks[index - 1] = {
      ...previousBlock,
      content: mergedContent
    };
    newBlocks.splice(index, 1); // Remove current block
    
    onChange(newBlocks);
    setFocusedBlockIndex(index - 1);
    
    // Store cursor position for the block to use
    setTimeout(() => {
      // Focus and set cursor position in the merged block
      const previousInput = document.querySelector(`[data-block-index="${index - 1}"] input, [data-block-index="${index - 1}"] textarea`) as HTMLInputElement | HTMLTextAreaElement;
      if (previousInput) {
        previousInput.focus();
        previousInput.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 0);
  }, [blocks, onChange, deleteBlock]);

  useKeyboardShortcuts({
    blocks,
    focusedBlockIndex,
    onAddBlock: addBlock,
    onDeleteBlock: deleteBlock,
    onDuplicateBlock: duplicateBlock,
    onMoveBlock: moveBlock,
    onFocusBlock: setFocusedBlockIndex,
  });

  if (blocks.length === 0) {
    return (
      <div 
        className="text-center py-16 cursor-text"
        onClick={() => addBlock('paragraph', 0)}
      >
        <div className="inline-flex items-center gap-2 text-muted-foreground">
          <span className="animate-pulse">|</span>
          <span className="text-sm">
            Press 'Enter' to continue with empty page or type '/' for commands
          </span>
        </div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="blocks">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="space-y-1"
          >
            {blocks.map((block, index) => (
              <Draggable key={block.id} draggableId={block.id} index={index}>
                {(provided, snapshot) => (
                  <div key={block.id}>
                    {index > 0 && !isNested && (
                      <AddBlockButton onClick={() => {
                        setShowMenuAtIndex(index);
                        addBlock('paragraph', index);
                      }} />
                    )}
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={cn(
                        "group relative py-1 px-2 -mx-2 rounded-md transition-all",
                        "hover:bg-accent/5",
                        snapshot.isDragging && "bg-accent/10 shadow-lg",
                        focusedBlockIndex === index && "bg-accent/5"
                      )}
                    >
                      <BlockControls
                        onDelete={() => deleteBlock(index)}
                        onDuplicate={() => duplicateBlock(index)}
                        isDragging={snapshot.isDragging}
                        dragHandleProps={provided.dragHandleProps}
                      />

                      <div className="relative" data-block-index={index}>
                        {block.type === 'heading' && (
                          <HeadingBlock
                            block={block}
                            isEditing={true}
                            onChange={(content) => updateBlock(index, { content })}
                            onFocus={() => setFocusedBlockIndex(index)}
                            autoFocus={focusedBlockIndex === index}
                            onBackspaceAtStart={() => mergeWithPreviousBlock(index)}
                          />
                        )}
                        {block.type === 'paragraph' && (
                          <>
                            <ParagraphBlock
                              block={block}
                              isEditing={true}
                              onChange={(content) => updateBlock(index, { content })}
                              onFocus={() => setFocusedBlockIndex(index)}
                              autoFocus={focusedBlockIndex === index}
                              onBackspaceAtStart={() => mergeWithPreviousBlock(index)}
                            />
                            {slashCommandIndex === index && (
                              <div className="relative mt-2">
                                <BlockTypeMenu
                                  onSelect={handleSlashCommandSelect}
                                  onClose={() => setSlashCommandIndex(null)}
                                  searchQuery={block.content.slice(1)}
                                />
                              </div>
                            )}
                          </>
                        )}
                        {block.type === 'divider' && <DividerBlock />}
                        {block.type === 'checklist' && (
                          <ChecklistBlock
                            block={block}
                            isEditing={true}
                            onChange={(content, checked) => 
                              updateBlock(index, { content, checked })
                            }
                            onFocus={() => setFocusedBlockIndex(index)}
                            autoFocus={focusedBlockIndex === index}
                            onBackspaceAtStart={() => mergeWithPreviousBlock(index)}
                          />
                        )}
                        {block.type === 'toggle' && (
                          <ToggleBlock
                            block={block}
                            isEditing={true}
                            onChange={(content, collapsed, children) =>
                              updateBlock(index, { content, collapsed, children })
                            }
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            
            {!isNested && (
              <AddBlockButton onClick={() => addBlock('paragraph')} />
            )}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

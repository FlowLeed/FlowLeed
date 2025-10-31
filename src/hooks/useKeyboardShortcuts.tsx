import { useEffect } from "react";
import { Block, BlockType } from "@/types/resources";

interface UseKeyboardShortcutsProps {
  blocks: Block[];
  focusedBlockIndex: number | null;
  onAddBlock: (type: BlockType, index?: number, level?: number) => void;
  onDeleteBlock: (index: number) => void;
  onDuplicateBlock: (index: number) => void;
  onMoveBlock: (fromIndex: number, toIndex: number) => void;
  onFocusBlock: (index: number) => void;
}

export const useKeyboardShortcuts = ({
  blocks,
  focusedBlockIndex,
  onAddBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveBlock,
  onFocusBlock,
}: UseKeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Enter: Create new paragraph below
      if (e.key === 'Enter' && !mod && focusedBlockIndex !== null) {
        e.preventDefault();
        onAddBlock('paragraph', focusedBlockIndex + 1);
        setTimeout(() => onFocusBlock(focusedBlockIndex + 1), 0);
      }

      // Cmd/Ctrl + D: Duplicate block
      if (e.key === 'd' && mod && focusedBlockIndex !== null) {
        e.preventDefault();
        onDuplicateBlock(focusedBlockIndex);
      }

      // Cmd/Ctrl + Shift + Up: Move block up
      if (e.key === 'ArrowUp' && mod && e.shiftKey && focusedBlockIndex !== null && focusedBlockIndex > 0) {
        e.preventDefault();
        onMoveBlock(focusedBlockIndex, focusedBlockIndex - 1);
        onFocusBlock(focusedBlockIndex - 1);
      }

      // Cmd/Ctrl + Shift + Down: Move block down
      if (e.key === 'ArrowDown' && mod && e.shiftKey && focusedBlockIndex !== null && focusedBlockIndex < blocks.length - 1) {
        e.preventDefault();
        onMoveBlock(focusedBlockIndex, focusedBlockIndex + 1);
        onFocusBlock(focusedBlockIndex + 1);
      }

      // Cmd/Ctrl + Alt + Number: Create heading with level
      if (mod && e.altKey && focusedBlockIndex !== null) {
        if (e.key === '1') {
          e.preventDefault();
          onAddBlock('heading', focusedBlockIndex + 1, 1);
          setTimeout(() => onFocusBlock(focusedBlockIndex + 1), 0);
        } else if (e.key === '2') {
          e.preventDefault();
          onAddBlock('heading', focusedBlockIndex + 1, 2);
          setTimeout(() => onFocusBlock(focusedBlockIndex + 1), 0);
        } else if (e.key === '3') {
          e.preventDefault();
          onAddBlock('heading', focusedBlockIndex + 1, 3);
          setTimeout(() => onFocusBlock(focusedBlockIndex + 1), 0);
        } else if (e.key === '0') {
          e.preventDefault();
          onAddBlock('paragraph', focusedBlockIndex + 1);
          setTimeout(() => onFocusBlock(focusedBlockIndex + 1), 0);
        } else if (e.key === '4') {
          e.preventDefault();
          onAddBlock('checklist', focusedBlockIndex + 1);
          setTimeout(() => onFocusBlock(focusedBlockIndex + 1), 0);
        } else if (e.key === '5') {
          e.preventDefault();
          onAddBlock('toggle', focusedBlockIndex + 1);
          setTimeout(() => onFocusBlock(focusedBlockIndex + 1), 0);
        } else if (e.key === '-') {
          e.preventDefault();
          onAddBlock('divider', focusedBlockIndex + 1);
          setTimeout(() => onFocusBlock(focusedBlockIndex + 1), 0);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [blocks, focusedBlockIndex, onAddBlock, onDeleteBlock, onDuplicateBlock, onMoveBlock, onFocusBlock]);
};

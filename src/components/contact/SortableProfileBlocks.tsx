import React, { useEffect, useState } from "react";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
/** 3x3 dot grid drag handle icon. */
const GripDots = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 12 12" fill="currentColor" className={className} aria-hidden="true">
    {[0, 1, 2].map((row) =>
      [0, 1, 2].map((col) => (
        <circle key={`${row}-${col}`} cx={2 + col * 4} cy={2 + row * 4} r="1.2" />
      )),
    )}
  </svg>
);
import { cn } from "@/lib/utils";

export interface ProfileBlock {
  id: string;
  label: string;
  node: React.ReactNode;
}

const STORAGE_KEY = "flowleed:profile-block-order";

const SortableItem = ({ block }: { block: ProfileBlock }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("profile-block group relative", isDragging && "z-10 opacity-80")}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Move ${block.label}`}
        title="Drag to reorder"
        className="absolute right-2 top-2 z-10 flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded text-muted-foreground opacity-40 transition-opacity hover:bg-muted hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {block.node}
    </div>
  );
};

/** Profile blocks the leader can drag into their own order (saved on this device). */
export const SortableProfileBlocks = ({ blocks }: { blocks: ProfileBlock[] }) => {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }, [order]);

  const ids = blocks.map((b) => b.id);
  const sorted = [...ids].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia === -1 ? 999 + ids.indexOf(a) : ia) - (ib === -1 ? 999 + ids.indexOf(b) : ib);
  });
  const byId = Object.fromEntries(blocks.map((b) => [b.id, b]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setOrder(arrayMove(sorted, sorted.indexOf(String(active.id)), sorted.indexOf(String(over.id))));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={sorted} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {sorted.map((id) => (
            <SortableItem key={id} block={byId[id]} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

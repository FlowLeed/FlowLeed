import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GripVertical, X, Search } from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PcoFieldDef, PcoTabGroup } from "@/hooks/useContactPcoFieldData";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tabs: PcoTabGroup[];
  fields: PcoFieldDef[];
  initialSelected: string[];
  initialHideEmpty: boolean;
  initialOpenByDefault: boolean;
  onSave: (prefs: { selected_field_ids: string[]; hide_empty: boolean; open_by_default: boolean }) => void;
  saving?: boolean;
}

function SortableRow({ id, label, tabName, onRemove }: {
  id: string; label: string; tabName: string; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm"
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{label}</div>
        <div className="truncate text-xs text-muted-foreground">{tabName}</div>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function PcoFieldsPreferenceDialog({
  open, onOpenChange, tabs, fields, initialSelected, initialHideEmpty, initialOpenByDefault, onSave, saving,
}: Props) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [hideEmpty, setHideEmpty] = useState(initialHideEmpty);
  const [openByDefault, setOpenByDefault] = useState(initialOpenByDefault);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setSelected(initialSelected);
      setHideEmpty(initialHideEmpty);
      setOpenByDefault(initialOpenByDefault);
      setSearch("");
    }
  }, [open, initialSelected, initialHideEmpty, initialOpenByDefault]);

  const fieldMap = useMemo(() => {
    const m = new Map<string, PcoFieldDef>();
    fields.forEach(f => m.set(f.id, f));
    return m;
  }, [fields]);

  const filteredTabs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabs;
    return tabs
      .map(t => ({
        ...t,
        fields: t.fields.filter(f =>
          f.name.toLowerCase().includes(q) || t.tabName.toLowerCase().includes(q)
        ),
      }))
      .filter(t => t.fields.length > 0);
  }, [tabs, search]);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSelected(prev => {
      const oldIdx = prev.indexOf(String(active.id));
      const newIdx = prev.indexOf(String(over.id));
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Planning Center fields</DialogTitle>
          <DialogDescription>
            Pick the fields you want to see for every contact. Drag to reorder.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fields…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
          {/* Available */}
          <div className="flex flex-col min-h-0 border rounded-md">
            <div className="px-3 py-2 border-b text-xs font-medium text-muted-foreground">
              Available fields
            </div>
            <ScrollArea className="flex-1 max-h-[50vh]">
              <div className="p-2 space-y-3">
                {filteredTabs.length === 0 && (
                  <div className="text-sm text-muted-foreground p-4 text-center">
                    No fields found.
                  </div>
                )}
                {filteredTabs.map(tab => {
                  const tabFieldIds = tab.fields.map(f => f.id);
                  const allChecked = tabFieldIds.every(id => selected.includes(id));
                  return (
                    <div key={tab.tabName}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {tab.tabName}
                        </div>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => {
                            setSelected(prev => allChecked
                              ? prev.filter(id => !tabFieldIds.includes(id))
                              : Array.from(new Set([...prev, ...tabFieldIds])));
                          }}
                        >
                          {allChecked ? "Clear" : "Select all"}
                        </button>
                      </div>
                      <div className="space-y-1">
                        {tab.fields.map(f => (
                          <label
                            key={f.id}
                            className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent cursor-pointer"
                          >
                            <Checkbox
                              checked={selected.includes(f.id)}
                              onCheckedChange={() => toggle(f.id)}
                            />
                            <span className="truncate">{f.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Selected (ordered) */}
          <div className="flex flex-col min-h-0 border rounded-md">
            <div className="px-3 py-2 border-b text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Your selection ({selected.length})</span>
              {selected.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setSelected([])}
                >
                  Clear all
                </button>
              )}
            </div>
            <ScrollArea className="flex-1 max-h-[50vh]">
              <div className="p-2">
                {selected.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-4 text-center">
                    Check fields on the left to add them here.
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={selected} strategy={verticalListSortingStrategy}>
                      <div className="space-y-1.5">
                        {selected.map(id => {
                          const f = fieldMap.get(id);
                          if (!f) return null;
                          return (
                            <SortableRow
                              key={id}
                              id={id}
                              label={f.name}
                              tabName={f.tabName}
                              onRemove={() => toggle(id)}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch id="hide-empty" checked={hideEmpty} onCheckedChange={setHideEmpty} />
            <Label htmlFor="hide-empty" className="text-sm">Hide empty fields</Label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => onSave({ selected_field_ids: selected, hide_empty: hideEmpty })}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

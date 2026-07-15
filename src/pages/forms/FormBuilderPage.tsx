import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Header } from "@/components/layout/Header";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  GripVertical,
  Pencil,
  Type,
  AlignLeft,
  Mail,
  Phone,
  Hash,
  Calendar,
  ChevronDown,
  CircleDot,
  CheckSquare,
  Settings2,
} from "lucide-react";

type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "checkbox";

type Field = {
  id?: string;
  _cid: string; // client-side stable id for dnd
  field_key: string;
  label: string;
  field_type: FieldType;
  required: boolean;
  placeholder?: string | null;
  options?: string[] | null;
  sort_order: number;
  _new?: boolean;
  _deleted?: boolean;
};

const PALETTE: Array<{
  type: FieldType;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { type: "text", label: "Short Text", hint: "Single line input", Icon: Type },
  { type: "textarea", label: "Long Text", hint: "Multi-line input", Icon: AlignLeft },
  { type: "email", label: "Email Address", hint: "Email format validation", Icon: Mail },
  { type: "phone", label: "Phone", hint: "Phone number", Icon: Phone },
  { type: "number", label: "Number", hint: "Numeric input", Icon: Hash },
  { type: "date", label: "Date", hint: "Date picker", Icon: Calendar },
  { type: "select", label: "Dropdown", hint: "Select single option", Icon: ChevronDown },
  { type: "radio", label: "Radio", hint: "Select one option", Icon: CircleDot },
  { type: "checkbox", label: "Checkboxes", hint: "Select multiple options", Icon: CheckSquare },
];

const iconFor = (t: FieldType) => PALETTE.find((p) => p.type === t)?.Icon || Type;

let cidCounter = 0;
const nextCid = () => `cid_${Date.now()}_${cidCounter++}`;

// ----------------------- Palette item (draggable source) -----------------------
function PaletteItem({ type, label, hint, Icon }: (typeof PALETTE)[number]) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { source: "palette", fieldType: type },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`group flex items-center gap-3 rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 hover:bg-accent/40 transition ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        <div className="text-xs text-muted-foreground truncate">{hint}</div>
      </div>
    </div>
  );
}

// ----------------------- Field preview (renders faux input for the field type) -----------------------
function FieldPreview({ field }: { field: Field }) {
  const opts = field.options || [];
  switch (field.field_type) {
    case "textarea":
      return (
        <Textarea
          disabled
          placeholder={field.placeholder || "Long answer..."}
          className="bg-background/60"
          rows={3}
        />
      );
    case "select":
      return (
        <div className="h-10 rounded-md border bg-background/60 px-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>{field.placeholder || "Select an option"}</span>
          <ChevronDown className="h-4 w-4" />
        </div>
      );
    case "radio":
      return (
        <div className="space-y-1.5">
          {(opts.length ? opts : ["Option 1", "Option 2"]).map((o, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-3.5 w-3.5 rounded-full border" />
              {o}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className="space-y-1.5">
          {(opts.length ? opts : ["Option 1", "Option 2"]).map((o, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-3.5 w-3.5 rounded-sm border" />
              {o}
            </label>
          ))}
        </div>
      );
    case "date":
      return <Input disabled type="date" className="bg-background/60" />;
    default:
      return (
        <Input
          disabled
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
          className="bg-background/60"
        />
      );
  }
}

// ----------------------- Canvas field card (sortable + selectable) -----------------------
function CanvasField({
  field,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  field: Field;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field._cid,
    data: { source: "canvas" },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group relative rounded-lg border bg-card p-4 pl-8 transition cursor-pointer ${
        selected ? "border-primary ring-2 ring-primary/40" : "hover:border-primary/40"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Actions */}
      <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <div className="text-sm font-medium">{field.label || "Untitled field"}</div>
        {field.required && <span className="text-destructive text-sm leading-none">*</span>}
      </div>
      <FieldPreview field={field} />
    </div>
  );
}

// ----------------------- Canvas drop zone -----------------------
function CanvasDropZone({
  children,
  empty,
  isOver,
}: {
  children: React.ReactNode;
  empty: boolean;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: "canvas-drop" });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 border-dashed p-4 min-h-[300px] transition ${
        isOver ? "border-primary bg-primary/5" : "border-border/60"
      }`}
    >
      {empty ? (
        <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground">
          <div className="text-sm font-medium">Drag a field here to get started</div>
          <div className="text-xs mt-1">Pick from the palette on the left</div>
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </div>
  );
}

// ============================================================================
// Main page
// ============================================================================
export default function FormBuilderPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { organization } = useProfile();
  const orgSlug = organization?.slug;

  const { data: form } = useQuery({
    queryKey: ["form", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("forms").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: initialFields } = useQuery({
    queryKey: ["form-fields", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("*")
        .eq("form_id", id!)
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedCid, setSelectedCid] = useState<string | null>(null);
  const [editingCid, setEditingCid] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragging, setDragging] = useState<
    | { source: "palette"; fieldType: FieldType }
    | { source: "canvas"; cid: string }
    | null
  >(null);
  const [canvasOver, setCanvasOver] = useState(false);

  useEffect(() => {
    if (form) {
      setName(form.name);
      setDescription(form.description || "");
      setIsPublished(form.is_published);
      setSuccessMessage(form.success_message || "");
      setPipelineId(form.pipeline_id);
      setStageId(form.stage_id);
    }
  }, [form]);

  useEffect(() => {
    if (initialFields) {
      setFields(
        initialFields.map((f) => ({
          id: f.id,
          _cid: nextCid(),
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          required: f.required,
          placeholder: f.placeholder,
          options: Array.isArray(f.options) ? f.options : null,
          sort_order: f.sort_order,
        })),
      );
    }
  }, [initialFields]);

  const { data: pipelines } = useQuery({
    queryKey: ["pipelines-for-form", form?.organization_id],
    enabled: !!form?.organization_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("organization_id", form!.organization_id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stages } = useQuery({
    queryKey: ["stages-for-form", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name, stage_order")
        .eq("pipeline_id", pipelineId!)
        .order("stage_order");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const { error: fErr } = await supabase
        .from("forms")
        .update({
          name,
          description,
          is_published: isPublished,
          success_message: successMessage,
          pipeline_id: pipelineId,
          stage_id: stageId,
        })
        .eq("id", id);
      if (fErr) throw fErr;

      // Reassign sort orders from current array order
      const ordered = fields.filter((f) => !f._deleted);
      const orderMap = new Map(ordered.map((f, i) => [f._cid, i]));

      for (const f of fields) {
        if (f._deleted && f.id) {
          await supabase.from("form_fields").delete().eq("id", f.id);
        } else if (f._new && !f._deleted) {
          await supabase.from("form_fields").insert({
            form_id: id,
            field_key: f.field_key,
            label: f.label,
            field_type: f.field_type,
            required: f.required,
            placeholder: f.placeholder,
            options: f.options,
            sort_order: orderMap.get(f._cid) ?? 0,
          });
        } else if (f.id) {
          await supabase
            .from("form_fields")
            .update({
              field_key: f.field_key,
              label: f.label,
              field_type: f.field_type,
              required: f.required,
              placeholder: f.placeholder,
              options: f.options,
              sort_order: orderMap.get(f._cid) ?? 0,
            })
            .eq("id", f.id);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Saved" });
      qc.invalidateQueries({ queryKey: ["form", id] });
      qc.invalidateQueries({ queryKey: ["form-fields", id] });
      qc.invalidateQueries({ queryKey: ["forms"] });
    },
    onError: (e: any) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const addField = (type: FieldType, insertAtCid?: string | null) => {
    const visible = fields.filter((f) => !f._deleted);
    const paletteEntry = PALETTE.find((p) => p.type === type)!;
    const newField: Field = {
      _cid: nextCid(),
      field_key: `field_${visible.length + 1}`,
      label: paletteEntry.label,
      field_type: type,
      required: false,
      placeholder: null,
      options: ["select", "radio", "checkbox"].includes(type) ? ["Option 1", "Option 2"] : null,
      sort_order: visible.length,
      _new: true,
    };

    setFields((prev) => {
      const next = [...prev];
      if (insertAtCid) {
        const idx = next.findIndex((f) => f._cid === insertAtCid && !f._deleted);
        if (idx >= 0) {
          next.splice(idx, 0, newField);
          return next;
        }
      }
      next.push(newField);
      return next;
    });
    setSelectedCid(newField._cid);
  };

  const updateFieldByCid = (cid: string, patch: Partial<Field>) => {
    setFields((prev) => prev.map((f) => (f._cid === cid ? { ...f, ...patch } : f)));
  };

  const removeFieldByCid = (cid: string) => {
    setFields((prev) =>
      prev
        .map((f) => (f._cid === cid ? { ...f, _deleted: true } : f))
        .filter((f) => !(f._deleted && f._new)),
    );
    if (selectedCid === cid) setSelectedCid(null);
    if (editingCid === cid) setEditingCid(null);
  };

  const visibleFields = useMemo(() => fields.filter((f) => !f._deleted), [fields]);
  const editingField = editingCid ? fields.find((f) => f._cid === editingCid) : null;

  const publicUrl = form
    ? orgSlug
      ? `${window.location.origin}/${orgSlug}/f/${form.slug}`
      : `${window.location.origin}/f/${form.slug}`
    : "";

  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Link copied", description: publicUrl });
  };

  // --------------- DnD ---------------
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as any;
    if (data?.source === "palette") {
      setDragging({ source: "palette", fieldType: data.fieldType });
    } else {
      setDragging({ source: "canvas", cid: String(e.active.id) });
    }
  };

  const handleDragOver = (e: any) => {
    const overId = e.over?.id;
    setCanvasOver(!!overId);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const active = e.active;
    const over = e.over;
    const activeData = active.data.current as any;
    setDragging(null);
    setCanvasOver(false);
    if (!over) return;

    if (activeData?.source === "palette") {
      const type = activeData.fieldType as FieldType;
      const overId = String(over.id);
      if (overId === "canvas-drop") {
        addField(type, null);
      } else {
        // dropped over an existing field — insert before it
        addField(type, overId);
      }
      return;
    }

    // reorder within canvas
    if (activeData?.source === "canvas" && over.id !== active.id) {
      const oldIndex = visibleFields.findIndex((f) => f._cid === active.id);
      const newIndex = visibleFields.findIndex((f) => f._cid === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        const newVisible = arrayMove(visibleFields, oldIndex, newIndex);
        // rebuild fields keeping deleted rows in place at end
        const deleted = fields.filter((f) => f._deleted);
        setFields([...newVisible, ...deleted]);
      }
    }
  };

  const DragOverlayContent = () => {
    if (!dragging) return null;
    if (dragging.source === "palette") {
      const p = PALETTE.find((x) => x.type === dragging.fieldType)!;
      const Icon = p.Icon;
      return (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-lg w-64">
          <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">{p.label}</div>
        </div>
      );
    }
    const f = fields.find((x) => x._cid === dragging.cid);
    if (!f) return null;
    return (
      <div className="rounded-lg border bg-card p-4 shadow-lg w-[420px] opacity-90">
        <div className="text-sm font-medium mb-2">{f.label}</div>
        <FieldPreview field={f} />
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header
        title={name || "Form"}
        rightContent={
          <div className="flex items-center gap-2">
            <Badge
              variant={isPublished ? "default" : "secondary"}
              className={isPublished ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
            >
              {isPublished ? "Live" : "Draft"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1" /> Settings
            </Button>
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="h-4 w-4 mr-1" /> Copy link
            </Button>
            {form && (
              <Button variant="outline" size="sm" asChild>
                <a href={`${publicUrl}?preview=1`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" /> Preview
                </a>
              </Button>
            )}
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
          </div>
        }
      />

      <div className="border-b bg-background/50 px-6 py-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/forms">
            <ArrowLeft className="h-4 w-4 mr-1" /> All forms
          </Link>
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setDragging(null);
          setCanvasOver(false);
        }}
      >
        <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr] gap-0">
          {/* Palette */}
          <aside className="border-r bg-muted/20 overflow-y-auto p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Add Fields
            </div>
            <div className="space-y-2">
              {PALETTE.map((p) => (
                <PaletteItem key={p.type} {...p} />
              ))}
            </div>
          </aside>

          {/* Canvas */}
          <main className="overflow-y-auto p-6 bg-muted/10">
            <div className="max-w-2xl mx-auto space-y-4">
              <div>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Form title"
                  className="text-xl font-semibold border-0 bg-transparent px-0 focus-visible:ring-0 shadow-none h-auto py-1"
                />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a short description..."
                  rows={1}
                  className="border-0 bg-transparent px-0 focus-visible:ring-0 shadow-none resize-none text-sm text-muted-foreground"
                />
              </div>

              <SortableContext
                items={visibleFields.map((f) => f._cid)}
                strategy={verticalListSortingStrategy}
              >
                <CanvasDropZone empty={visibleFields.length === 0} isOver={canvasOver}>
                  {visibleFields.map((f) => (
                    <CanvasField
                      key={f._cid}
                      field={f}
                      selected={selectedCid === f._cid}
                      onSelect={() => setSelectedCid(f._cid)}
                      onEdit={() => setEditingCid(f._cid)}
                      onDelete={() => removeFieldByCid(f._cid)}
                    />
                  ))}
                </CanvasDropZone>
              </SortableContext>
            </div>
          </main>
        </div>

        <DragOverlay>
          <DragOverlayContent />
        </DragOverlay>
      </DndContext>

      {/* Field editor sheet */}
      <Sheet open={!!editingField} onOpenChange={(o) => !o && setEditingCid(null)}>
        <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit field</SheetTitle>
          </SheetHeader>
          {editingField && (
            <div className="mt-6 space-y-4">
              <div>
                <Label>Label</Label>
                <Input
                  value={editingField.label}
                  onChange={(e) => updateFieldByCid(editingField._cid, { label: e.target.value })}
                />
              </div>
              <div>
                <Label>Field type</Label>
                <Select
                  value={editingField.field_type}
                  onValueChange={(v: FieldType) =>
                    updateFieldByCid(editingField._cid, {
                      field_type: v,
                      options:
                        ["select", "radio", "checkbox"].includes(v) && !editingField.options?.length
                          ? ["Option 1", "Option 2"]
                          : editingField.options,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PALETTE.map((p) => (
                      <SelectItem key={p.type} value={p.type}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Placeholder</Label>
                <Input
                  value={editingField.placeholder || ""}
                  onChange={(e) =>
                    updateFieldByCid(editingField._cid, { placeholder: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Field key</Label>
                <Input
                  value={editingField.field_key}
                  onChange={(e) =>
                    updateFieldByCid(editingField._cid, { field_key: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Stored on the submission. Use lowercase, no spaces.
                </p>
              </div>
              {["select", "radio", "checkbox"].includes(editingField.field_type) && (
                <div>
                  <Label>Options</Label>
                  <Textarea
                    rows={5}
                    placeholder={"One option per line"}
                    value={(editingField.options || []).join("\n")}
                    onChange={(e) =>
                      updateFieldByCid(editingField._cid, {
                        options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>
              )}
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Required</div>
                  <div className="text-xs text-muted-foreground">Must be filled to submit</div>
                </div>
                <Switch
                  checked={editingField.required}
                  onCheckedChange={(v) => updateFieldByCid(editingField._cid, { required: v })}
                />
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => removeFieldByCid(editingField._cid)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete field
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Form settings sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Form settings</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Published</div>
                <div className="text-xs text-muted-foreground">
                  When on, the form is publicly accessible
                </div>
              </div>
              <Switch checked={isPublished} onCheckedChange={setIsPublished} />
            </div>
            <div>
              <Label>Success message</Label>
              <Input
                value={successMessage}
                onChange={(e) => setSuccessMessage(e.target.value)}
                placeholder="Thanks! We'll be in touch."
              />
            </div>
            <div className="pt-2 border-t">
              <div className="text-sm font-medium mb-2">Route submissions</div>
              <div className="space-y-3">
                <div>
                  <Label>Flow</Label>
                  <Select
                    value={pipelineId ?? "none"}
                    onValueChange={(v) => {
                      setPipelineId(v === "none" ? null : v);
                      setStageId(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select flow" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {(pipelines || []).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Stage</Label>
                  <Select
                    value={stageId ?? ""}
                    onValueChange={(v) => setStageId(v || null)}
                    disabled={!pipelineId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {(stages || []).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

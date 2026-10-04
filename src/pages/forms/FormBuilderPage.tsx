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
import { publicUrl as buildPublicUrl } from "@/lib/publicUrl";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type EmailSettings = {
  confirmation?: { enabled?: boolean; from_name?: string; reply_to?: string; subject?: string; body?: string };
  notify?: { enabled?: boolean; recipients?: string; subject?: string };
};
import { Header } from "@/components/layout/Header";
import { FormTabs } from "@/components/forms/FormTabs";
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
  Save,
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

function MobilePaletteItem({
  type,
  label,
  Icon,
  onAdd,
}: (typeof PALETTE)[number] & { onAdd: (type: FieldType) => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto min-h-14 justify-start gap-3 px-3 py-2 text-left"
      onClick={() => onAdd(type)}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </span>
      <span className="min-w-0 truncate text-sm font-medium">{label}</span>
    </Button>
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
      className={`group relative rounded-lg border bg-card p-3 pl-9 pr-20 transition cursor-pointer sm:p-4 sm:pl-8 ${
        selected ? "border-primary ring-2 ring-primary/40" : "hover:border-primary/40"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-1 top-1/2 flex h-9 w-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground cursor-grab active:cursor-grabbing sm:left-1.5 sm:h-auto sm:w-auto sm:p-1 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Actions */}
      <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 transition sm:right-2 sm:top-2 sm:gap-1 sm:opacity-0 sm:group-hover:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 sm:h-7 sm:w-7"
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
          className="h-9 w-9 text-destructive hover:text-destructive sm:h-7 sm:w-7"
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
      className={`rounded-xl border-2 border-dashed p-2 min-h-[300px] transition sm:p-4 ${
        isOver ? "border-primary bg-primary/5" : "border-border/60"
      }`}
    >
      {empty ? (
        <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground">
          <div className="text-sm font-medium sm:hidden">Add your first field</div>
          <div className="mt-1 text-xs sm:hidden">Use Add field above</div>
          <div className="hidden text-sm font-medium sm:block">Drag a field here to get started</div>
          <div className="mt-1 hidden text-xs sm:block">Pick from the palette on the left</div>
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
  const [settingsOpen, setSettingsOpen] = useState(
    () => new URLSearchParams(window.location.search).get("tab") === "settings",
  );
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({});
  const setConfirm = (p: Partial<NonNullable<EmailSettings["confirmation"]>>) =>
    setEmailSettings((s) => ({ ...s, confirmation: { ...s.confirmation, ...p } }));
  const setNotify = (p: Partial<NonNullable<EmailSettings["notify"]>>) =>
    setEmailSettings((s) => ({ ...s, notify: { ...s.notify, ...p } }));
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
      setEmailSettings(((form as any).email_settings as EmailSettings) || {});
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
          email_settings: emailSettings as any,
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
    setFieldPickerOpen(false);
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
    ? buildPublicUrl(orgSlug ? `/${orgSlug}/f/${form.slug}` : `/f/${form.slug}`)
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

      <div className="border-b bg-background/50 px-2 py-2 sm:px-6">
        <div className="flex items-center gap-1 sm:hidden">
          <Button variant="ghost" size="icon" asChild className="h-10 w-10 shrink-0" aria-label="All forms">
            <Link to="/forms">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="min-w-0 flex-1 gap-1.5" onClick={() => setFieldPickerOpen(true)}>
            <Plus className="h-4 w-4" /> Add field
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setSettingsOpen((o) => !o)} aria-label="Form settings">
            <Settings2 className="h-4 w-4" />
          </Button>
          {form && (
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" asChild aria-label="Preview form">
              <a href={`${publicUrl}?preview=1`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          <Button size="icon" className="h-10 w-10 shrink-0" onClick={() => save.mutate()} disabled={save.isPending} aria-label="Save form">
            <Save className="h-4 w-4" />
          </Button>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="h-9 w-9" aria-label="All forms">
            <Link to="/forms">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          {id && <FormTabs formId={id} active={settingsOpen ? "settings" : "form"} onSettings={() => setSettingsOpen(true)} onForm={() => setSettingsOpen(false)} />}
        </div>
        {id && (
          <div className="sm:hidden mt-1">
            <FormTabs formId={id} active={settingsOpen ? "settings" : "form"} onSettings={() => setSettingsOpen(true)} onForm={() => setSettingsOpen(false)} />
          </div>
        )}
      </div>

      {settingsOpen ? (
        <div className="flex-1 min-h-0 overflow-y-auto bg-muted/10 p-3 pb-[max(env(safe-area-inset-bottom),1rem)] sm:p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <section className="rounded-lg border bg-background p-4 space-y-4">
              <h2 className="text-sm font-semibold">General</h2>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Published</div>
                  <div className="text-xs text-muted-foreground">When on, anyone with the link can fill it out</div>
                </div>
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
              </div>
              <div className="space-y-1.5">
                <Label>Message after submitting</Label>
                <Input value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} placeholder="Thanks! We'll be in touch." />
              </div>
            </section>

            <section className="rounded-lg border bg-background p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Flow</h2>
                <p className="text-xs text-muted-foreground">New submissions are added to this Flow and step.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Flow</Label>
                  <Select value={pipelineId ?? "none"} onValueChange={(v) => { setPipelineId(v === "none" ? null : v); setStageId(null); }}>
                    <SelectTrigger><SelectValue placeholder="Select flow" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {(pipelines || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Step</Label>
                  <Select value={stageId ?? ""} onValueChange={(v) => setStageId(v || null)} disabled={!pipelineId}>
                    <SelectTrigger><SelectValue placeholder="Select step" /></SelectTrigger>
                    <SelectContent>
                      {(stages || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="rounded-lg border bg-background p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Thank-you email</h2>
                  <p className="text-xs text-muted-foreground">Sent to the person who filled out the form (needs an Email field).</p>
                </div>
                <Switch checked={!!emailSettings.confirmation?.enabled} onCheckedChange={(v) => setConfirm({ enabled: v })} />
              </div>
              {emailSettings.confirmation?.enabled && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>From name</Label>
                      <Input value={emailSettings.confirmation?.from_name ?? ""} onChange={(e) => setConfirm({ from_name: e.target.value })} placeholder="The Promise Center" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Replies go to</Label>
                      <Input type="email" value={emailSettings.confirmation?.reply_to ?? ""} onChange={(e) => setConfirm({ reply_to: e.target.value })} placeholder="pastor@yourchurch.org" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subject</Label>
                    <Input value={emailSettings.confirmation?.subject ?? ""} onChange={(e) => setConfirm({ subject: e.target.value })} placeholder={`Thanks for signing up, {first_name}!`} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Message</Label>
                    <Textarea rows={5} value={emailSettings.confirmation?.body ?? ""} onChange={(e) => setConfirm({ body: e.target.value })} placeholder={`Hi {first_name},\n\nThanks for filling out ${name || "our form"}. We'll be in touch soon.`} />
                    <div className="text-xs text-muted-foreground">Use {"{first_name}"}, {"{name}"} or {"{form_name}"} to personalize. A copy of their answers is included.</div>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-lg border bg-background p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Team alert email</h2>
                  <p className="text-xs text-muted-foreground">Let someone on your team know each time a form comes in.</p>
                </div>
                <Switch checked={!!emailSettings.notify?.enabled} onCheckedChange={(v) => setNotify({ enabled: v })} />
              </div>
              {emailSettings.notify?.enabled && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Send to</Label>
                    <Input value={emailSettings.notify?.recipients ?? ""} onChange={(e) => setNotify({ recipients: e.target.value })} placeholder="pastor@yourchurch.org, office@yourchurch.org" />
                    <div className="text-xs text-muted-foreground">Separate several emails with commas.</div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subject</Label>
                    <Input value={emailSettings.notify?.subject ?? ""} onChange={(e) => setNotify({ subject: e.target.value })} placeholder={`New submission: {form_name} from {name}`} />
                  </div>
                </div>
              )}
            </section>

            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save settings</Button>
          </div>
        </div>
      ) : (
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
        <div className="flex-1 min-h-0 grid grid-cols-1 gap-0 sm:grid-cols-[280px_1fr]">
          {/* Palette */}
          <aside className="hidden border-r bg-muted/20 overflow-y-auto p-4 sm:block">
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
          <main className="overflow-y-auto bg-muted/10 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:p-6">
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
      )}

      <Sheet open={fieldPickerOpen} onOpenChange={setFieldPickerOpen}>
        <SheetContent side="bottom" className="max-h-[78dvh] overflow-y-auto rounded-t-lg px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-5 sm:hidden">
          <SheetHeader className="text-left">
            <SheetTitle>Add a field</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {PALETTE.map((item) => (
              <MobilePaletteItem key={item.type} {...item} onAdd={addField} />
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Field editor sheet */}
      <Sheet open={!!editingField} onOpenChange={(o) => !o && setEditingCid(null)}>
        <SheetContent className="w-full max-w-full overflow-y-auto sm:w-[420px] sm:max-w-[420px]">
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

    </div>
  );
}

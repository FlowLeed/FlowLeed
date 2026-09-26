import { useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Heading2,
  ImagePlus,
  Images,
  Loader2,
  Megaphone,
  Plus,
  Quote as QuoteIcon,
  Trash2,
  Type,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { StoryBlock, StoryBlockType } from "@/lib/storyTypes";
import { useStoryEditor } from "./StoryEditorContext";
import { NextStepBlockEditor } from "./NextStepBlockEditor";

export type EditableBlock = Partial<StoryBlock> & { clientId: string; block_type: StoryBlockType };

export const newBlock = (block_type: StoryBlockType, body?: string): EditableBlock => ({
  clientId: crypto.randomUUID(),
  block_type,
  body: body ?? (block_type === "next_step" ? "auto" : undefined),
  gallery_items: [],
});

const BLOCK_LIBRARY: Array<{
  type: StoryBlockType;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { type: "heading", label: "Chapter title", hint: "Before, What changed, Today", Icon: Heading2 },
  { type: "paragraph", label: "Story text", hint: "A short, readable paragraph", Icon: Type },
  { type: "quote", label: "Pull quote", hint: "One line that says it all", Icon: QuoteIcon },
  { type: "image", label: "Photo", hint: "One photo with a caption", Icon: ImagePlus },
  { type: "gallery", label: "Photo group", hint: "A few photos side by side", Icon: Images },
  { type: "video", label: "Video clip", hint: "A YouTube moment", Icon: Video },
  { type: "next_step", label: "Next step", hint: "Invite them to take a step", Icon: Megaphone },
];

const labelFor = (type: StoryBlockType) => BLOCK_LIBRARY.find((item) => item.type === type)?.label ?? type;
const IconFor = (type: StoryBlockType) => BLOCK_LIBRARY.find((item) => item.type === type)?.Icon ?? Type;

function AddBlockButton({
  onAdd,
  variant = "inline",
}: {
  onAdd: (type: StoryBlockType, body?: string) => void;
  variant?: "inline" | "primary";
}) {
  const [open, setOpen] = useState(false);
  const { nextSteps } = useStoryEditor();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "primary" ? (
          <Button type="button" variant="outline" className="w-full border-dashed">
            <Plus className="mr-2 h-4 w-4" />
            Add a section
          </Button>
        ) : (
          <button
            type="button"
            className="group flex w-full items-center gap-2 py-1 text-xs text-muted-foreground opacity-0 transition hover:text-foreground focus:opacity-100 group-hover/slot:opacity-100 [@media(hover:none)]:opacity-100"
            aria-label="Insert a section here"
          >
            <span className="h-px flex-1 bg-border" />
            <span className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5">
              <Plus className="h-3 w-3" />
              Insert
            </span>
            <span className="h-px flex-1 bg-border" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="center" className="w-72 p-2">
        <div className="space-y-1">
          {BLOCK_LIBRARY.map(({ type, label, hint, Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onAdd(type);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-md p-2 text-left transition hover:bg-accent"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{label}</span>
                <span className="block truncate text-xs text-muted-foreground">{hint}</span>
              </span>
            </button>
          ))}
          {nextSteps.presets.length > 0 && <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Church next steps</p>}
          {nextSteps.presets.map((preset) => (
            <button key={preset.id} type="button" onClick={() => { onAdd("next_step", `preset:${preset.id}`); setOpen(false); }} className="flex w-full items-center gap-3 rounded-md p-2 text-left transition hover:bg-accent">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10"><Megaphone className="h-4 w-4 text-primary" /></span>
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{preset.headline}</span><span className="block truncate text-xs text-muted-foreground">{preset.is_global ? "Church-wide default" : preset.category}</span></span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BlockEditor({
  block,
  update,
  upload,
  uploadingId,
}: {
  block: EditableBlock;
  update: (patch: Partial<EditableBlock>) => void;
  upload: (file: File, clientId: string) => Promise<string | null>;
  uploadingId: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = uploadingId === block.clientId;
  const gallery = block.gallery_items ?? [];

  if (block.block_type === "next_step") return <NextStepBlockEditor block={block} update={update} />;

  if (block.block_type === "heading") {
    return (
      <Input
        value={block.heading ?? ""}
        onChange={(event) => update({ heading: event.target.value })}
        placeholder="Chapter title"
        className="border-0 bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
      />
    );
  }

  if (block.block_type === "paragraph") {
    return (
      <Textarea
        rows={5}
        value={block.body ?? ""}
        onChange={(event) => update({ body: event.target.value })}
        placeholder="Write this part of the story…"
        className="border-0 bg-transparent px-0 text-base leading-7 shadow-none focus-visible:ring-0"
      />
    );
  }

  if (block.block_type === "quote") {
    return (
      <div className="space-y-2 border-l-2 border-primary pl-4">
        <Textarea
          rows={3}
          value={block.body ?? ""}
          onChange={(event) => update({ body: event.target.value })}
          placeholder="A defining line from the story"
          className="border-0 bg-transparent px-0 text-xl font-medium italic leading-8 shadow-none focus-visible:ring-0"
        />
        <Input
          value={block.quote_attribution ?? ""}
          onChange={(event) => update({ quote_attribution: event.target.value })}
          placeholder="Who said it"
          className="h-8 border-0 bg-transparent px-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
        />
      </div>
    );
  }

  if (block.block_type === "image") {
    return (
      <div className="space-y-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const url = await upload(file, block.clientId);
            if (url) update({ media_url: url });
          }}
        />
        {block.media_url ? (
          <img src={block.media_url} alt={block.media_alt ?? ""} className="w-full rounded-md object-cover" />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
            No photo yet
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
            {block.media_url ? "Replace photo" : "Upload photo"}
          </Button>
        </div>
        <Input
          value={block.caption ?? ""}
          onChange={(event) => update({ caption: event.target.value })}
          placeholder="Optional caption"
          className="h-9 text-sm"
        />
        <Input
          value={block.media_alt ?? ""}
          onChange={(event) => update({ media_alt: event.target.value })}
          placeholder="Describe the photo (for screen readers)"
          className="h-9 text-sm"
        />
      </div>
    );
  }

  if (block.block_type === "gallery") {
    return (
      <div className="space-y-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            const added: Array<{ url: string; alt?: string; caption?: string }> = [];
            for (const file of files) {
              const url = await upload(file, block.clientId);
              if (url) added.push({ url });
            }
            if (added.length) update({ gallery_items: [...gallery, ...added] });
          }}
        />
        {gallery.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {gallery.map((item, index) => (
              <div key={`${item.url}-${index}`} className="group/photo relative overflow-hidden rounded-md">
                <img src={item.url} alt={item.alt ?? ""} className="aspect-square w-full object-cover" />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-1 top-1 h-7 w-7"
                  aria-label="Remove photo"
                  onClick={() => update({ gallery_items: gallery.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Images className="mr-2 h-4 w-4" />}
          Add photos
        </Button>
        <Input
          value={block.caption ?? ""}
          onChange={(event) => update({ caption: event.target.value })}
          placeholder="Optional caption"
          className="h-9 text-sm"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
      <Input
        value={block.video_id ?? ""}
        onChange={(event) => update({ video_id: event.target.value })}
        placeholder="YouTube video ID"
      />
      <Select
        value={block.video_orientation ?? "horizontal"}
        onValueChange={(value) => update({ video_orientation: value as "horizontal" | "vertical" })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="horizontal">Wide video</SelectItem>
          <SelectItem value="vertical">Tall video</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function SortableBlock({
  block,
  index,
  total,
  update,
  move,
  duplicate,
  remove,
  upload,
  uploadingId,
  onInsert,
}: {
  block: EditableBlock;
  index: number;
  total: number;
  update: (patch: Partial<EditableBlock>) => void;
  move: (direction: -1 | 1) => void;
  duplicate: () => void;
  remove: () => void;
  upload: (file: File, clientId: string) => Promise<string | null>;
  uploadingId: string | null;
  onInsert: (type: StoryBlockType, body?: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: block.clientId,
  });
  const Icon = IconFor(block.block_type);

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="group/slot">
      <div className="pb-1">
        <AddBlockButton onAdd={onInsert} />
      </div>
      <div
        className={`group/block rounded-lg border bg-card p-4 transition hover:border-primary/40 ${
          isDragging ? "opacity-60 shadow-lg" : ""
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              className="cursor-grab text-muted-foreground active:cursor-grabbing"
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {labelFor(block.block_type)}
            </span>
          </div>
          <div className="flex shrink-0 opacity-60 transition group-hover/block:opacity-100">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === 0} onClick={() => move(-1)} aria-label="Move up">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === total - 1} onClick={() => move(1)} aria-label="Move down">
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={duplicate} aria-label="Duplicate section">
              <Copy className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={remove} aria-label="Remove section">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <BlockEditor block={block} update={update} upload={upload} uploadingId={uploadingId} />
      </div>
    </div>
  );
}

export function StoryBlockCanvas({
  blocks,
  setBlocks,
  organizationId,
  videoId,
}: {
  blocks: EditableBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<EditableBlock[]>>;
  organizationId: string;
  videoId: string;
}) {
  const { toast } = useToast();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const upload = async (file: File, clientId: string) => {
    setUploadingId(clientId);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${organizationId}/${videoId}/block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from("story-media").upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      return supabase.storage.from("story-media").getPublicUrl(path).data.publicUrl;
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingId(null);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((current) => {
      const from = current.findIndex((item) => item.clientId === active.id);
      const to = current.findIndex((item) => item.clientId === over.id);
      if (from < 0 || to < 0) return current;
      return arrayMove(current, from, to);
    });
  };

  const insertAt = (index: number, type: StoryBlockType, body?: string) =>
    setBlocks((current) => {
      const next = [...current];
      next.splice(index, 0, newBlock(type, body));
      return next;
    });

  return (
    <div className="space-y-2">
      {blocks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-5 py-12 text-center">
          <p className="text-sm font-medium">Start building the story</p>
          <p className="mt-1 text-sm text-muted-foreground">Add a chapter title, a paragraph, a quote, or a photo.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={blocks.map((block) => block.clientId)} strategy={verticalListSortingStrategy}>
            {blocks.map((block, index) => (
              <SortableBlock
                key={block.clientId}
                block={block}
                index={index}
                total={blocks.length}
                update={(patch) =>
                  setBlocks((current) => current.map((item) => (item.clientId === block.clientId ? { ...item, ...patch } : item)))
                }
                move={(direction) =>
                  setBlocks((current) => {
                    const target = index + direction;
                    if (target < 0 || target >= current.length) return current;
                    return arrayMove(current, index, target);
                  })
                }
                duplicate={() =>
                  setBlocks((current) => {
                    const next = [...current];
                    next.splice(index + 1, 0, { ...block, clientId: crypto.randomUUID(), id: undefined });
                    return next;
                  })
                }
                remove={() => setBlocks((current) => current.filter((item) => item.clientId !== block.clientId))}
                upload={upload}
                uploadingId={uploadingId}
                onInsert={(type, body) => insertAt(index, type, body)}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
      <div className="pt-2">
        <AddBlockButton variant="primary" onAdd={(type, body) => insertAt(blocks.length, type, body)} />
      </div>
    </div>
  );
}

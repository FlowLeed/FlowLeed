import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import { HandHeart, Link2, EyeOff, MoreVertical, Plus, Trash2, Pencil, Sparkles, CheckCircle2, LayoutGrid, Table2, Search, X } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { LinkPersonDialog } from "@/components/prayer/LinkPersonDialog";

type Stage = { id: string; name: string; color: string; stage_order: number; is_answered_step: boolean };
type Req = {
  id: string; title: string | null; description: string | null; kind: string; status: string | null;
  is_anonymous: boolean; submitter_name: string | null; contact_id: string | null; stage_id: string | null;
  created_at: string; answer_description: string | null;
  prayers: { user_id: string; created_at: string }[]; contactName?: string | null;
};

const COLORS = ["#3B82F6", "#F59E0B", "#8B5CF6", "#10B981", "#EF4444", "#EC4899", "#14B8A6", "#6B7280"];
const DEFAULT_STAGES = [
  { name: "New", color: "#3B82F6", is_answered_step: false },
  { name: "Praying", color: "#8B5CF6", is_answered_step: false },
  { name: "Follow-up needed", color: "#F59E0B", is_answered_step: false },
  { name: "Praise reports", color: "#10B981", is_answered_step: true },
];
const db = supabase as any;

export default function PrayerHubPage() {
  const { user } = useAuth();
  const { organization } = useProfile();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const seeding = useRef(false);
  const [anonOnly, setAnonOnly] = useState(false);
  const [editing, setEditing] = useState<Partial<Stage> | null>(null);
  const [view, setView] = useState<"board" | "table">("board");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [linking, setLinking] = useState<Req | null>(null);

  const stagesQ = useQuery({
    queryKey: ["prayer-stages", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db.from("prayer_stages").select("*").eq("organization_id", orgId).order("stage_order");
      if (error) throw error;
      return (data || []) as Stage[];
    },
  });

  useEffect(() => {
    if (!orgId || !stagesQ.data || stagesQ.data.length || seeding.current) return;
    seeding.current = true;
    db.from("prayer_stages").insert(DEFAULT_STAGES.map((s, i) => ({ ...s, stage_order: i, organization_id: orgId })))
      .then(() => qc.invalidateQueries({ queryKey: ["prayer-stages", orgId] }));
  }, [orgId, stagesQ.data, qc]);

  const reqQ = useQuery({
    queryKey: ["prayer-hub", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db.from("contact_prayer_requests")
        .select("*, prayers:prayer_request_prayers(user_id, created_at)")
        .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      const rows = (data || []) as Req[];
      const ids = [...new Set(rows.map((r) => r.contact_id).filter(Boolean))] as string[];
      const names = new Map<string, string>();
      if (ids.length) {
        const { data: cs } = await supabase.from("contacts").select("id, name").in("id", ids);
        cs?.forEach((c: any) => names.set(c.id, c.name));
      }
      return rows.map((r) => ({ ...r, contactName: r.contact_id ? names.get(r.contact_id) : null }));
    },
  });

  const stages = stagesQ.data || [];
  const requests = reqQ.data || [];
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["prayer-hub", orgId] });
    qc.invalidateQueries({ queryKey: ["prayer-stages", orgId] });
  };

  const stageOf = (r: Req) => {
    const first = stages[0]?.id;
    const answered = stages.find((s) => s.is_answered_step)?.id ?? first;
    if (r.stage_id && stages.some((s) => s.id === r.stage_id)) return r.stage_id;
    return (r.kind === "praise" || r.status === "answered") ? answered : first;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (anonOnly && !r.is_anonymous) return false;
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (stageFilter !== "all" && stageOf(r) !== stageFilter) return false;
      if (q) {
        const who = (r.is_anonymous ? "anonymous" : r.contactName || r.submitter_name || "").toLowerCase();
        const text = [r.title, r.description, r.answer_description].filter(Boolean).join(" ").toLowerCase();
        if (!who.includes(q) && !text.includes(q)) return false;
      }
      return true;
    });
  }, [requests, anonOnly, kindFilter, stageFilter, search, stages]);

  const hasFilters = anonOnly || kindFilter !== "all" || stageFilter !== "all" || !!search.trim();
  const clearFilters = () => { setAnonOnly(false); setKindFilter("all"); setStageFilter("all"); setSearch(""); };

  // Requests without a step: answered ones go to the first answered step, the rest to the first step.
  const columns = useMemo(() => {
    const map = new Map<string, Req[]>(stages.map((s) => [s.id, []]));
    filtered.forEach((r) => {
      const sid = stageOf(r);
      if (sid && map.has(sid)) map.get(sid)!.push(r);
    });
    return map;
  }, [stages, filtered]);

  const moveToStage = async (r: Req, stageId: string) => {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) return;
    const patch: any = { stage_id: stage.id };
    if (stage.is_answered_step) { patch.status = "answered"; patch.answered_at = new Date().toISOString(); }
    else { patch.status = "active"; }
    qc.setQueryData(["prayer-hub", orgId], (old: Req[] = []) => old.map((x) => x.id === r.id ? { ...x, ...patch } : x));
    const { error } = await db.from("contact_prayer_requests").update(patch).eq("id", r.id);
    if (error) { toast.error("Couldn't move"); refresh(); }
  };

  const onDragEnd = async (res: DropResult) => {
    if (!res.destination || res.destination.droppableId === res.source.droppableId) return;
    const r = requests.find((x) => x.id === res.draggableId);
    if (r) moveToStage(r, res.destination.droppableId);
  };

  const pray = async (r: Req) => {
    const { error } = await db.from("prayer_request_prayers").insert({ prayer_request_id: r.id, organization_id: orgId, user_id: user!.id });
    if (error) return toast.error("Couldn't save");
    toast.success("Thank you for praying");
    refresh();
  };

  const saveStage = async () => {
    if (!editing?.name?.trim()) return;
    const payload = { name: editing.name.trim(), color: editing.color || COLORS[0], is_answered_step: !!editing.is_answered_step };
    const { error } = editing.id
      ? await db.from("prayer_stages").update(payload).eq("id", editing.id)
      : await db.from("prayer_stages").insert({ ...payload, organization_id: orgId, stage_order: stages.length });
    if (error) return toast.error("Couldn't save step");
    setEditing(null);
    refresh();
  };

  const deleteStage = async (s: Stage) => {
    if (stages.length <= 1) return toast.error("Keep at least one step");
    if (!confirm(`Delete "${s.name}"? Its requests move to the first step.`)) return;
    await db.from("prayer_stages").delete().eq("id", s.id);
    refresh();
  };

  const copyLink = () => {
    const url = `${window.location.origin}/${(organization as any)?.slug}/pray`;
    navigator.clipboard.writeText(url);
    toast.success("Prayer form link copied", { description: url });
  };

  const loading = stagesQ.isLoading || reqQ.isLoading || !stages.length;

  return (
    <div className="flex flex-col h-full">
      <Header title="Prayer" showFlowIcon={false} showAddButton={false} />
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests..." className="pl-9 w-[200px] h-9" />
        </div>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="prayer">Prayer</SelectItem>
            <SelectItem value="praise">Praise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Step" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All steps</SelectItem>
            {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="anon" checked={anonOnly} onCheckedChange={setAnonOnly} />
          <Label htmlFor="anon" className="text-sm font-normal flex items-center gap-1"><EyeOff className="h-3.5 w-3.5" />Anonymous only</Label>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1"><X className="h-3.5 w-3.5" />Clear</Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-md border">
            <button onClick={() => setView("board")} aria-label="Board view"
              className={cn("px-2.5 h-9 flex items-center rounded-l-md", view === "board" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setView("table")} aria-label="Table view"
              className={cn("px-2.5 h-9 flex items-center rounded-r-md", view === "table" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Table2 className="h-4 w-4" />
            </button>
          </div>
          <Button size="sm" variant="outline" onClick={copyLink}><Link2 className="mr-1 h-4 w-4" />Share prayer form</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex gap-4 p-5">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-96 w-72 flex-shrink-0 rounded-xl" />)}</div>
        ) : view === "table" ? (
          <div className="p-5">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Person</TableHead>
                    <TableHead className="w-[40%]">Request</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Prayed</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No requests match your filters.</TableCell></TableRow>
                  )}
                  {filtered.map((r) => {
                    const who = r.is_anonymous ? "Anonymous" : r.contactName || r.submitter_name || "Someone";
                    const sid = stageOf(r);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <span className="flex items-center gap-1.5 font-medium">
                            {r.is_anonymous && <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                            {!r.is_anonymous && r.contact_id
                              ? <Link to={`/contacts/${r.contact_id}`} className="hover:underline">{who}</Link>
                              : who}
                          </span>
                          {!r.contact_id && (
                            <button onClick={() => setLinking(r)} className="mt-0.5 flex items-center gap-1 text-xs text-primary hover:underline">
                              <UserPlus className="h-3 w-3" />Link to person
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <span className="line-clamp-2 whitespace-pre-wrap">{[r.title, r.description].filter(Boolean).join(" — ")}</span>
                        </TableCell>
                        <TableCell>
                          {r.kind === "praise"
                            ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Praise</span>
                            : <span className="text-sm text-muted-foreground">Prayer</span>}
                        </TableCell>
                        <TableCell>
                          <Select value={sid || ""} onValueChange={(v) => moveToStage(r, v)}>
                            <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {stages.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <button onClick={() => pray(r)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                            <HandHeart className="h-3.5 w-3.5" />{r.prayers.length > 0 ? r.prayers.length : "Pray"}
                          </button>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 p-5 min-h-full items-start">
              {stages.map((s) => {
                const items = columns.get(s.id) || [];
                return (
                  <div key={s.id} style={{ borderColor: s.color }} className="w-72 flex-shrink-0 p-3 border shadow-sm rounded-xl flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <h3 className="font-normal text-foreground truncate">{s.name}</h3>
                      <span className="text-xs text-muted-foreground">{items.length}</span>
                      {s.is_answered_step && <Badge variant="secondary" className="text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Answered</Badge>}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="ml-auto p-1 rounded-full hover:bg-muted" aria-label="Step settings"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(s)}><Pencil className="mr-2 h-4 w-4" />Edit step</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteStage(s)}><Trash2 className="mr-2 h-4 w-4" />Delete step</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Droppable droppableId={s.id}>
                      {(p, snap) => (
                        <div ref={p.innerRef} {...p.droppableProps} className={cn("space-y-3 min-h-[200px] p-1 rounded-lg transition-colors", snap.isDraggingOver && "bg-muted")}>
                          {items.map((r, i) => (
                            <Draggable key={r.id} draggableId={r.id} index={i}>
                              {(dp, ds) => (
                                <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps}>
                                  <PrayerCard r={r} dragging={ds.isDragging} onPray={() => pray(r)} onLink={() => setLinking(r)} />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {p.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
              <button onClick={() => setEditing({ color: COLORS[stages.length % COLORS.length] })}
                className="w-72 flex-shrink-0 h-14 rounded-xl border border-dashed text-sm text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center gap-1">
                <Plus className="h-4 w-4" />Add step
              </button>
            </div>
          </DragDropContext>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit step" : "New step"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input autoFocus placeholder="Step name" value={editing?.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && saveStage()} />
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setEditing({ ...editing, color: c })} style={{ backgroundColor: c }}
                  className={cn("h-7 w-7 rounded-full ring-offset-2 ring-offset-background", editing?.color === c && "ring-2 ring-ring")} aria-label={c} />
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ans" className="font-normal text-sm">Requests here count as answered (praise)</Label>
              <Switch id="ans" checked={!!editing?.is_answered_step} onCheckedChange={(v) => setEditing({ ...editing, is_answered_step: v })} />
            </div>
          </div>
          <DialogFooter><Button onClick={saveStage}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <LinkPersonDialog request={linking} orgId={orgId} onClose={() => setLinking(null)} onLinked={refresh} />
    </div>
  );
}

function PrayerCard({ r, dragging, onPray, onLink }: { r: Req; dragging: boolean; onPray: () => void; onLink: () => void }) {
  const who = r.is_anonymous ? "Anonymous" : r.contactName || r.submitter_name || "Someone";
  const text = [r.title, r.description].filter(Boolean).join(" — ");
  return (
    <div className={cn("rounded-lg border bg-card p-3 space-y-2 shadow-sm", dragging && "shadow-lg")}>
      <div className="flex items-center gap-1.5 text-sm">
        {r.is_anonymous && <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
        {!r.is_anonymous && r.contact_id
          ? <Link to={`/contacts/${r.contact_id}`} className="font-semibold truncate hover:underline">{who}</Link>
          : <span className="font-semibold truncate">{who}</span>}
        {r.kind === "praise" && <span className="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">Praise</span>}
      </div>
      <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">{text}</p>
      {!r.contact_id && (
        <button onClick={onLink} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <UserPlus className="h-3.5 w-3.5" />Link to person
        </button>
      )}
      {r.answer_description && <p className="text-xs text-muted-foreground"><Sparkles className="inline h-3 w-3 mr-1" />{r.answer_description}</p>}
      <div className="flex items-center justify-between">
        <button onClick={onPray} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
          <HandHeart className="h-3.5 w-3.5" />Prayed{r.prayers.length > 0 && ` · ${r.prayers.length}`}
        </button>
        <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
      </div>
    </div>
  );
}

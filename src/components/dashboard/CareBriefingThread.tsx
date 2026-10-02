import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO, isToday, isBefore, startOfToday } from "date-fns";
import { HeartHandshake, RefreshCw, UserRound, Loader2, Sun, MessageCircle, CircleCheck, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useCareBriefing, OUTCOMES, type CareRecommendation } from "@/hooks/useCareBriefing";

const KIND_LABEL: Record<string, string> = {
  life_moment: "Life moment", faith_moment: "Faith step", drift: "Hasn't been around", follow_up: "Follow-up",
};
const STATUS_LABEL: Record<string, string> = {
  taking: "You're taking this", delegated: "Asked a leader", handled: "Handled", snoozed: "Snoozed", dismissed: "Not needed",
};

export function CareBriefingThread({ onAsk, onCheck, inThread = false }: { onAsk?: (prompt: string) => void; onCheck?: () => void; inThread?: boolean }) {
  const care = useCareBriefing();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [delegating, setDelegating] = useState<CareRecommendation | null>(null);
  const [message, setMessage] = useState("");
  const [handling, setHandling] = useState<CareRecommendation | null>(null);
  const [outcome, setOutcome] = useState("spoke");
  const [note, setNote] = useState("");

  const days = useMemo(() => {
    const m = new Map<string, CareRecommendation[]>();
    const todayKey = format(new Date(), "yyyy-MM-dd");
    for (const r of care.list.data ?? []) { if (inThread && r.briefing_date !== todayKey) continue; if (!m.has(r.briefing_date)) m.set(r.briefing_date, []); m.get(r.briefing_date)!.push(r); }
    if ((care.todos.data?.length ?? 0) > 0) {
      const today = format(new Date(), "yyyy-MM-dd");
      if (!m.has(today)) m.set(today, []);
    }
    return [...m.entries()];
  }, [care.list.data, care.todos.data]);

  const overdueTasks = useMemo(
    () => (care.todos.data ?? []).filter((task) => isBefore(parseISO(task.due_at), startOfToday())),
    [care.todos.data],
  );
  const todayTasks = useMemo(
    () => (care.todos.data ?? []).filter((task) => isToday(parseISO(task.due_at))),
    [care.todos.data],
  );

  // Pull a fresh list when the leader opens FlowLeed AI (at most once an hour per browser tab).
  useEffect(() => {
    const k = "care-briefing-auto-refresh";
    const last = Number(sessionStorage.getItem(k) || 0);
    if (inThread || Date.now() - last < 3600000) return;
    sessionStorage.setItem(k, String(Date.now()));
    care.run.mutate({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDelegate = (r: CareRecommendation) => {
    const first = (r.contact?.name ?? "").split(" ")[0] || "them";
    setMessage(`Hi ${r.best_connection?.name?.split(" ")[0] ?? ""}, could you check in with ${first} this week? ${r.why}`.trim());
    setDelegating(r);
  };

  return (
    <div className="w-full max-w-3xl space-y-4 pb-2">
      {!inThread && <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => care.run.mutate(undefined, { onSuccess: () => onCheck?.() })} disabled={care.run.isPending} className="gap-1.5">
          {care.run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Check for today
        </Button>
      </div>}

      {care.status.data?.paused_reason && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">The daily briefing is paused: {care.status.data.paused_reason}.</p>
      )}

      {care.list.isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /> : days.length === 0 ? (
        <div className="flex gap-3">
          <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary" aria-label="FlowLeed AI"><HeartHandshake className="h-4 w-4 text-primary-foreground" /></div>
          <div className="py-2 text-sm text-muted-foreground">
            Every morning I'll bring the 3–5 people who most need your attention into this conversation. Tap <b>Check for today</b> to look now.
          </div>
        </div>
      ) : days.map(([date, recs]) => {
        const currentDay = isToday(parseISO(date));
        const needCare = recs.filter((r) => r.kind === "life_moment" || r.kind === "faith_moment");
        const checking = recs.filter((r) => r.kind === "drift" || r.kind === "follow_up");
        const row = (r: CareRecommendation) => {
          const open = expanded === r.id;
          const name = r.contact?.name ?? "Unknown person";
          return (
            <li key={r.id}>
              <button type="button" onClick={() => setExpanded(open ? null : r.id)} className={`w-full text-left text-sm py-1 hover:text-primary ${r.status !== "pending" ? "opacity-60" : ""}`}>
                <span className="font-semibold">{name},</span> {r.headline}
                {r.sensitive && <span className="font-semibold">, Pastoral review required</span>}
                {r.status !== "pending" && <span className="text-muted-foreground"> · {STATUS_LABEL[r.status]}</span>}
              </button>
              {open && (
                <div className="mt-2 mb-3 space-y-3 rounded-xl border bg-card p-4">
                  <p className="text-sm">{r.why}</p>
                  {r.known?.length > 0 && (
                    <ul className="list-disc pl-5 text-sm text-muted-foreground">{r.known.map((k, i) => <li key={i}>{k}</li>)}</ul>
                  )}
                  {r.best_connection && (
                    <p className="text-sm"><UserRound className="mr-1 inline h-4 w-4" />Best connection: <b>{r.best_connection.name}</b> <span className="text-muted-foreground">· {r.best_connection.role}</span></p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {r.status === "pending" && <>
                      <Button size="sm" onClick={() => care.takeCare.mutate(r)} disabled={care.takeCare.isPending}>I'll take care of this</Button>
                      {r.best_connection && !r.sensitive && <Button size="sm" variant="outline" onClick={() => openDelegate(r)}>Ask {r.best_connection.name?.split(" ")[0]}</Button>}
                      <Button size="sm" variant="outline" onClick={() => { setOutcome("spoke"); setNote(""); setHandling(r); }}>Already handled</Button>
                      <Button size="sm" variant="ghost" onClick={() => care.snooze.mutate(r)}>Snooze</Button>
                    </>}
                    {onAsk && <Button size="sm" variant="ghost" className="gap-1" onClick={() => onAsk(`Tell me more about ${name}.`)}><MessageCircle className="h-3.5 w-3.5" />Ask in chat</Button>}
                    <Button size="sm" variant="ghost" asChild><Link to={`/contacts/${r.contact_id}`}>Profile</Link></Button>
                  </div>
                </div>
              )}
            </li>
          );
        };
        return (
          <div key={date} className="flex gap-2 sm:gap-3">
            <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary" aria-label="FlowLeed AI"><HeartHandshake className="h-4 w-4 text-primary-foreground" /></div>
            <section className="min-w-0 flex-1 space-y-4 py-2">
              <h3 className="flex items-center gap-2 text-base font-semibold"><Sun className="h-4 w-4 text-primary" />Morning briefing — {format(parseISO(date), "EEEE, MMM d")}</h3>
              <p className="text-sm font-semibold">Who needs you {isToday(parseISO(date)) ? "today" : "that day"}?</p>
              {needCare.length > 0 && (
                <div><p className="mb-1 text-sm font-semibold">{needCare.length} Need Care</p><ul className="list-disc pl-5">{needCare.map(row)}</ul></div>
              )}
              {checking.length > 0 && (
                <div><p className="mb-1 text-sm font-semibold">Worth Checking On</p><ul className="list-disc pl-5">{checking.map(row)}</ul></div>
              )}
              {currentDay && (overdueTasks.length > 0 || todayTasks.length > 0) && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold"><ListTodo className="h-4 w-4 text-primary" />Today’s To-Dos</p>
                  <ul className="space-y-1">
                    {[...overdueTasks, ...todayTasks].map((task) => {
                      const overdue = overdueTasks.some((item) => item.id === task.id);
                      return (
                        <li key={task.id} className="flex min-w-0 items-center gap-2 text-sm">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary"
                            aria-label={`Complete ${task.title}`}
                            disabled={care.completeTodo.isPending}
                            onClick={() => care.completeTodo.mutate(task.id)}
                          >
                            <CircleCheck className="h-4 w-4" />
                          </Button>
                          <span className="min-w-0 flex-1 truncate">{task.title}</span>
                          {overdue && <span className="shrink-0 text-xs font-medium text-destructive">Overdue</span>}
                        </li>
                      );
                    })}
                  </ul>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild><Link to="/tasks">View all tasks</Link></Button>
                </div>
              )}
              {(needCare.length > 0 || checking.length > 0) && <p className="text-xs text-muted-foreground">Tap a name to see why and what to do.</p>}
            </section>
          </div>
        );
      })}

      <Dialog open={!!delegating} onOpenChange={(o) => !o && setDelegating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask {delegating?.best_connection?.name} to check in?</DialogTitle>
            <DialogDescription>This brings {delegating?.best_connection?.name} into {delegating?.contact?.name}'s care. They'll see exactly this message in their Tasks — edit it so it only shares what you're comfortable sharing.</DialogDescription>
          </DialogHeader>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelegating(null)}>Cancel</Button>
            <Button disabled={!message.trim() || care.delegate.isPending} onClick={() => delegating && care.delegate.mutate({ r: delegating, message: message.trim() }, { onSuccess: () => setDelegating(null) })}>Send to {delegating?.best_connection?.name?.split(" ")[0]}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!handling} onOpenChange={(o) => !o && setHandling(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>How was {handling?.contact?.name} cared for?</DialogTitle></DialogHeader>
          <RadioGroup value={outcome} onValueChange={setOutcome} className="space-y-2">
            {Object.entries(OUTCOMES).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2"><RadioGroupItem value={k} id={`o-${k}`} /><Label htmlFor={`o-${k}`}>{v}</Label></div>
            ))}
          </RadioGroup>
          <Textarea placeholder="Optional note for their profile" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setHandling(null)}>Cancel</Button>
            <Button disabled={care.handled.isPending} onClick={() => handling && care.handled.mutate({ r: handling, outcome, note: note.trim() }, { onSuccess: () => setHandling(null) })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

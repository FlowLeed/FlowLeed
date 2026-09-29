import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { HandHeart, Link2, Check, EyeOff, Sparkles } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Prayer = { user_id: string; created_at: string };
type Req = {
  id: string; title: string | null; description: string | null; kind: string; status: string | null;
  is_anonymous: boolean; source: string; submitter_name: string | null; contact_id: string | null;
  created_at: string; answered_at: string | null; answer_description: string | null;
  prayers: Prayer[]; contactName?: string | null;
};

const TABS = [
  { key: "all", label: "All" },
  { key: "followup", label: "Follow-up needed" },
  { key: "anonymous", label: "Anonymous" },
  { key: "praise", label: "Praise reports" },
] as const;

export default function PrayerHubPage() {
  const { user } = useAuth();
  const { organization } = useProfile();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [answering, setAnswering] = useState<Req | null>(null);
  const [answer, setAnswer] = useState("");
  const orgId = organization?.id;

  const { data = [], isLoading } = useQuery({
    queryKey: ["prayer-hub", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_prayer_requests" as any)
        .select("*, prayers:prayer_request_prayers(user_id, created_at)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const rows = (data as unknown as Req[]) || [];
      const ids = [...new Set(rows.map((r) => r.contact_id).filter(Boolean))] as string[];
      const names = new Map<string, string>();
      if (ids.length) {
        const { data: cs } = await supabase.from("contacts").select("id, name").in("id", ids);
        cs?.forEach((c: any) => names.set(c.id, c.name));
      }
      return rows.map((r) => ({ ...r, contactName: r.contact_id ? names.get(r.contact_id) : null }));
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["prayer-hub", orgId] });

  const pray = useMutation({
    mutationFn: async (r: Req) => {
      const { error } = await supabase.from("prayer_request_prayers" as any)
        .insert({ prayer_request_id: r.id, organization_id: orgId, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Thank you for praying"); refresh(); },
    onError: () => toast.error("Couldn't save"),
  });

  const markAnswered = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contact_prayer_requests" as any)
        .update({ status: "answered", answered_at: new Date().toISOString(), answer_description: answer || null })
        .eq("id", answering!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Moved to Praise reports"); setAnswering(null); setAnswer(""); refresh(); },
    onError: () => toast.error("Couldn't save"),
  });

  const myLastPrayer = (r: Req) =>
    r.prayers.filter((p) => p.user_id === user?.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  const isPraise = (r: Req) => r.kind === "praise" || r.status === "answered";

  const list = useMemo(() => data.filter((r) => {
    if (tab === "praise") return isPraise(r);
    if (tab === "anonymous") return r.is_anonymous && !isPraise(r);
    if (tab === "followup") { const p = myLastPrayer(r); return !isPraise(r) && !!p && differenceInDays(new Date(), new Date(p.created_at)) >= 7; }
    return !isPraise(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, tab, user?.id]);

  const copyLink = () => {
    const url = `${window.location.origin}/${(organization as any)?.slug}/pray`;
    navigator.clipboard.writeText(url);
    toast.success("Prayer form link copied", { description: url });
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Prayer" showFlowIcon={false} showAddButton={false} />
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-2xl mx-auto px-5 py-6 pb-24">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Prayer Hub</h2>
            <Button size="sm" variant="outline" onClick={copyLink}><Link2 className="mr-1 h-4 w-4" />Share prayer form</Button>
          </div>
          <div className="mb-4 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn("whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition",
                  tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                {t.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : list.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <p>{tab === "followup" ? "Nothing to follow up on yet." : tab === "praise" ? "No praise reports yet." : "No prayer requests yet."}</p>
              {tab === "all" && <p className="text-sm">Share the prayer form so people can send requests.</p>}
            </div>
          ) : (
            <div className="divide-y">
              {list.map((r) => {
                const who = r.is_anonymous ? "Anonymous" : r.contactName || r.submitter_name || "Someone";
                const mine = myLastPrayer(r);
                const text = [r.title, r.description].filter(Boolean).join(" — ");
                return (
                  <div key={r.id} className="py-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      {r.is_anonymous && <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                      {!r.is_anonymous && r.contact_id ? (
                        <Link to={`/contacts/${r.contact_id}`} className="font-semibold hover:underline">{who}</Link>
                      ) : <span className="font-semibold">{who}</span>}
                      {isPraise(r) && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Praise</span>}
                      <span className="text-muted-foreground text-xs ml-auto">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{text}</p>
                    {r.answer_description && <p className="text-sm text-muted-foreground"><Sparkles className="inline h-3.5 w-3.5 mr-1" />{r.answer_description}</p>}
                    {tab === "followup" && mine && (
                      <p className="text-xs text-muted-foreground">You prayed for this {formatDistanceToNow(new Date(mine.created_at))} ago. Send an encouragement?</p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" variant="ghost" onClick={() => pray.mutate(r)} disabled={pray.isPending}>
                        <HandHeart className="mr-1 h-4 w-4" />Prayed{r.prayers.length > 0 && ` · ${r.prayers.length}`}
                      </Button>
                      {!isPraise(r) && (
                        <Button size="sm" variant="ghost" onClick={() => setAnswering(r)}><Check className="mr-1 h-4 w-4" />Mark answered</Button>
                      )}
                      {!r.is_anonymous && r.contact_id && tab === "followup" && (
                        <Button size="sm" variant="ghost" asChild><Link to={`/contacts/${r.contact_id}`}>Encourage</Link></Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!answering} onOpenChange={(o) => !o && setAnswering(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Prayer answered</DialogTitle></DialogHeader>
          <Textarea autoFocus rows={3} placeholder="How did God answer? (optional)" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <Button onClick={() => markAnswered.mutate()} disabled={markAnswered.isPending}>Move to Praise reports</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Person = { id: string; name: string; email: string | null; phone: string | null };

interface Props {
  request: { id: string; submitter_name: string | null } | null;
  orgId?: string;
  onClose: () => void;
  onLinked: () => void;
}

const sanitize = (s: string) => s.replace(/[%_,()*\\]/g, " ").trim();

async function findPeople(orgId: string, q: string): Promise<Person[]> {
  const words = sanitize(q).split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  let query = supabase.from("contacts").select("id, name, email, phone").eq("organization_id", orgId);
  words.forEach((w) => { query = query.ilike("name", `%${w}%`); });
  const { data } = await query.limit(8);
  return (data || []) as Person[];
}

/** Suggests people whose name matches the submitter, and lets a leader search and link manually. */
export function LinkPersonDialog({ request, orgId, onClose, onLinked }: Props) {
  const [suggested, setSuggested] = useState<Person[]>([]);
  const [results, setResults] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setQ(""); setResults([]); setSuggested([]);
    if (!request || !orgId || !request.submitter_name) return;
    setLoading(true);
    (async () => {
      const name = request.submitter_name!;
      let found = await findPeople(orgId, name);
      if (!found.length) {
        // Fall back to last name only (e.g. different first-name spelling)
        const parts = sanitize(name).split(/\s+/);
        if (parts.length > 1) found = await findPeople(orgId, parts[parts.length - 1]);
      }
      setSuggested(found);
      setLoading(false);
    })();
  }, [request, orgId]);

  useEffect(() => {
    if (!orgId || q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => findPeople(orgId, q).then(setResults), 250);
    return () => clearTimeout(t);
  }, [q, orgId]);

  const link = async (p: Person) => {
    if (!request) return;
    setSaving(p.id);
    const { error } = await (supabase as any).from("contact_prayer_requests").update({ contact_id: p.id }).eq("id", request.id);
    setSaving(null);
    if (error) return toast.error("Could not link this request");
    toast.success(`Linked to ${p.name}`);
    onLinked();
    onClose();
  };

  const Row = ({ p }: { p: Person }) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{p.name}</p>
        <p className="text-xs text-muted-foreground truncate">{[p.email, p.phone].filter(Boolean).join(" · ") || "No contact info"}</p>
      </div>
      <Button size="sm" onClick={() => link(p)} disabled={!!saving}>
        {saving === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Link"}
      </Button>
    </div>
  );

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link to person</DialogTitle>
          <DialogDescription>
            {request?.submitter_name ? `Submitted as "${request.submitter_name}". Confirm who this is.` : "Choose who submitted this request."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {request?.submitter_name && (
            <div className="space-y-2">
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Sparkles className="h-3 w-3" />Suggested matches</p>
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                : suggested.length ? suggested.map((p) => <Row key={p.id} p={p} />)
                : <p className="text-sm text-muted-foreground">No one with a similar name.</p>}
            </div>
          )}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {results.map((p) => <Row key={p.id} p={p} />)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

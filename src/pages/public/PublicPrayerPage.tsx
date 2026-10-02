import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOrganizationLogoUrl } from "@/api/organizations";

export default function PublicPrayerPage() {
  const { slug } = useParams();
  const [org, setOrg] = useState<{ name: string; logo_url?: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [kind, setKind] = useState<"prayer" | "praise">("prayer");
  const [request, setRequest] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.functions.invoke("public-prayer-submit", { body: { org_slug: slug, mode: "info" } })
      .then(({ data, error }) => (error || !data?.organization ? setNotFound(true) : setOrg(data.organization)));
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    const { data, error } = await supabase.functions.invoke("public-prayer-submit", {
      body: { org_slug: slug, kind, request, name, email, phone, anonymous, honeypot },
    });
    setSending(false);
    if (error || data?.error) return setError(data?.error || "Could not send. Please try again.");
    setDone(true);
  };

  if (notFound) return <div className="h-screen flex items-center justify-center text-muted-foreground">This page isn't available.</div>;
  if (!org) return <div className="h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="h-screen overflow-y-auto bg-muted/30">
      <div className="max-w-lg mx-auto px-5 py-10">
        <div className="text-center mb-6">
          {org.logo_url && <img src={getOrganizationLogoUrl(slug || "")} alt={org.name} className="h-14 mx-auto mb-3 object-contain" />}
          <p className="text-sm text-muted-foreground">{org.name}</p>
        </div>
        <div className="bg-card border rounded-2xl shadow-sm p-6 md:p-8">
          {done ? (
            <div className="text-center py-8 space-y-2">
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              <h1 className="text-xl font-semibold">{kind === "praise" ? "Thank you for sharing!" : "We're praying with you."}</h1>
              <p className="text-muted-foreground text-sm">Our team has received your {kind === "praise" ? "praise report" : "request"}.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-medium">
                {(["prayer", "praise"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setKind(k)}
                    className={cn("rounded-md py-2 transition", kind === k ? "bg-background shadow-sm" : "text-muted-foreground")}>
                    {k === "prayer" ? "Prayer Request" : "Praise Report"}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>{kind === "prayer" ? "What's on your heart?" : "What has God done?"}</Label>
                <Textarea required rows={6} value={request} onChange={(e) => setRequest(e.target.value)} maxLength={5000}
                  placeholder={kind === "prayer" ? "Share as much or as little as you'd like…" : "Tell us the good news…"} />
              </div>
              <div className="space-y-3">
                <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
                <Input type="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
                <Input type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <Label htmlFor="anon" className="font-normal text-sm">Keep my name private when shared with the prayer team</Label>
                <Switch id="anon" checked={anonymous} onCheckedChange={setAnonymous} />
              </div>
              <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="hidden" aria-hidden="true" />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
              </Button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">Powered by FlowLeed</p>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link2, AlertTriangle, CheckCircle2, Loader2, RefreshCw, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNeedsPersonalPco } from "@/hooks/useNeedsPersonalPco";


interface Conn {
  email: string | null;
  status: string;
  oauth_scopes: string | null;
  provider_account_id: string | null;
  updated_at: string;
  visible_people_synced_at: string | null;
  visible_people_count: number | null;
}

export function PcoPersonalConnection({ organizationId }: { organizationId?: string }) {
  const needsPersonal = useNeedsPersonalPco();
  const [conn, setConn] = useState<Conn | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);


  const load = async () => {
    if (!organizationId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("user_pco_connections")
      .select("email,status,oauth_scopes,provider_account_id,updated_at,visible_people_synced_at,visible_people_count")
      .eq("organization_id", organizationId)
      .maybeSingle();
    setConn((data as Conn) ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [organizationId]);

  // Auto-trigger a first sync after a successful connect
  useEffect(() => {
    if (conn && conn.status === "active" && !conn.visible_people_synced_at && !syncing) {
      runSync(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn?.status, conn?.visible_people_synced_at]);

  const connect = async () => {
    if (!organizationId) return;
    setBusy(true);
    let topOrigin = window.location.origin;
    try { if (window.top?.location?.origin) topOrigin = window.top.location.origin; } catch {}
    try {
      const { data, error } = await supabase.functions.invoke("pco-oauth-start", {
        body: { organizationId, purpose: "user", redirectOrigin: topOrigin },
      });
      if (error || !data?.authorizeUrl) {
        throw new Error(data?.error || error?.message || "Failed to start OAuth");
      }
      try {
        if (window.top) window.top.location.href = data.authorizeUrl;
        else window.location.href = data.authorizeUrl;
      } catch { window.location.href = data.authorizeUrl; }
    } catch (e: any) {
      toast.error(e.message || "Failed to start Planning Center sign-in");
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!organizationId) return;
    setBusy(true);
    const { error } = await supabase
      .from("user_pco_connections")
      .delete()
      .eq("organization_id", organizationId);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Planning Center account disconnected"); load(); }
  };

  const runSync = async (silent = false) => {
    if (!organizationId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("pco-sync-user-permissions", {
        body: { organizationId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Sync failed");
      if (!silent) toast.success(`Synced ${data?.count ?? 0} visible people`);
      await load();
    } catch (e: any) {
      if (!silent) toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const reauth = conn?.status === "reauth_required";

  // Admins/owners use the church-wide connection on the Integrations page, and
  // nobody needs a personal sign-in unless per-user visibility is enforced.
  if (needsPersonal.isLoading || !needsPersonal.needed) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Your Planning Center permissions</CardTitle>
          </div>
          {conn && !reauth && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </Badge>
          )}
          {reauth && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Reconnect
            </Badge>
          )}
        </div>
        <CardDescription>
          A personal Planning Center sign-in, used only to match what you're allowed to see in
          Planning Center. This is separate from your church's Planning Center connection.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !conn ? (
          <Button onClick={connect} disabled={busy || !organizationId}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Connect Planning Center
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Signed in as:</span>{" "}
              <span className="font-medium">{conn.email ?? "—"}</span>
            </div>

            {!reauth && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {syncing ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Syncing visible people…
                  </span>
                ) : conn.visible_people_synced_at ? (
                  <span>
                    {conn.visible_people_count ?? 0} people visible · last synced{" "}
                    {formatDistanceToNow(new Date(conn.visible_people_synced_at), { addSuffix: true })}
                  </span>
                ) : (
                  <span>Not synced yet</span>
                )}
              </div>
            )}

            {reauth && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm">
                Your Planning Center session expired. Please reconnect to continue seeing PCO data.
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={connect} disabled={busy}>
                {reauth ? "Reconnect" : "Refresh connection"}
              </Button>
              {!reauth && (
                <Button variant="outline" onClick={() => runSync(false)} disabled={syncing}>
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Resync now
                </Button>
              )}
              <Button variant="ghost" onClick={disconnect} disabled={busy}>
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

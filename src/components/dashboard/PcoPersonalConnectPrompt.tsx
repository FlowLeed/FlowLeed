import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Link2, X } from "lucide-react";

type Status = "loading" | "missing" | "reauth" | "ok" | "na";

export function PcoPersonalConnectPrompt() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useProfile();
  const [status, setStatus] = useState<Status>("loading");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!user?.id || !organization?.id) return;

      // Only prompt if the org actually uses Planning Center on OAuth
      const { data: integ } = await supabase
        .from("integrations")
        .select("auth_type,status")
        .eq("organization_id", organization.id)
        .eq("service_name", "planning_center")
        .maybeSingle();

      if (!integ || integ.auth_type !== "oauth") {
        setStatus("na");
        return;
      }

      const { data: conn } = await supabase
        .from("user_pco_connections")
        .select("status")
        .eq("organization_id", organization.id)
        .maybeSingle();

      let next: Status;
      if (!conn) next = "missing";
      else if (conn.status === "reauth_required") next = "reauth";
      else next = "ok";

      setStatus(next);

      if (next === "missing" || next === "reauth") {
        const key = `pco-personal-prompt-${user.id}-${organization.id}`;
        const dismissedAt = localStorage.getItem(key);
        const oneDay = 24 * 60 * 60 * 1000;
        if (!dismissedAt || Date.now() - Number(dismissedAt) > oneDay) {
          setDialogOpen(true);
        }
      }
    };
    check();
  }, [user?.id, organization?.id]);

  const dismissDialog = () => {
    if (user?.id && organization?.id) {
      localStorage.setItem(
        `pco-personal-prompt-${user.id}-${organization.id}`,
        String(Date.now()),
      );
    }
    setDialogOpen(false);
  };

  const goConnect = () => {
    setDialogOpen(false);
    navigate("/profile");
  };

  if (status !== "missing" && status !== "reauth") return null;

  const isReauth = status === "reauth";

  return (
    <>
      {!bannerDismissed && (
        <div className="mx-4 md:mx-6 mt-3 rounded-lg border bg-card p-3 md:p-4 flex items-start gap-3">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            {isReauth ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <Link2 className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {isReauth
                ? "Reconnect your Planning Center account"
                : "Connect your Planning Center account"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              FlowLeed only shows you what you can see in PCO. This takes 10 seconds.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={goConnect}>
              {isReauth ? "Reconnect" : "Connect"}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => (o ? setDialogOpen(true) : dismissDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isReauth
                ? "Reconnect Planning Center"
                : "Connect your Planning Center account"}
            </DialogTitle>
            <DialogDescription>
              {isReauth
                ? "Your Planning Center session expired. Reconnect so FlowLeed keeps showing the people you can see in PCO."
                : "Connect Planning Center to FlowLeed so you can turn data into care, follow-up, and real ministry action."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={dismissDialog}>
              Remind me later
            </Button>
            <Button onClick={goConnect}>
              {isReauth ? "Reconnect now" : "Connect now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

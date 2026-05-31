import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Org admin-only toggle for `organizations.pco_enforce_user_permissions`.
 * When ON, regular members only see contacts whose PCO person ID is in their
 * personal visibility snapshot (see `can_user_see_contact`).
 */
export function PcoEnforcementToggle({ organizationId }: { organizationId?: string }) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!organizationId) { setLoading(false); return; }
      setLoading(true);
      const [{ data: { user } }, { data: org }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("organizations")
          .select("pco_enforce_user_permissions")
          .eq("id", organizationId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setEnabled(!!(org as any)?.pco_enforce_user_permissions);

      if (user) {
        const { data: m } = await supabase
          .from("organization_members")
          .select("role")
          .eq("organization_id", organizationId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled) setCanEdit(["owner", "admin"].includes(m?.role ?? ""));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [organizationId]);

  const toggle = async (next: boolean) => {
    if (!organizationId || !canEdit) return;
    setSaving(true);
    const prev = enabled;
    setEnabled(next);
    const { error } = await supabase
      .from("organizations")
      .update({ pco_enforce_user_permissions: next })
      .eq("id", organizationId);
    setSaving(false);
    if (error) {
      setEnabled(prev);
      toast.error(error.message);
    } else {
      toast.success(next ? "Per-user PCO permissions enforced" : "Enforcement turned off");
    }
  };

  if (loading || !canEdit) return null;

  return (
    <div className="rounded-lg border bg-card p-4 flex items-start gap-3">
      <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="pco-enforce" className="text-sm font-medium cursor-pointer">
            Restrict each user to their personal PCO visibility
          </Label>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            <Switch id="pco-enforce" checked={enabled} onCheckedChange={toggle} disabled={saving} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          When on, members only see contacts their connected Planning Center account can see. Users
          without a personal connection keep org-wide visibility. Admins and owners always see everything.
        </p>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserPlus, Mail, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { FlowIconBadge } from "@/components/search/FlowIconBadge";

interface InviteTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteSent: () => void;
}

interface FlowOption {
  id: string;
  name: string;
  icon?: string | null;
}

type FlowRole = "lead" | "member";

export const InviteTeamMemberDialog: React.FC<InviteTeamMemberDialogProps> = ({
  open,
  onOpenChange,
  onInviteSent,
}) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [flowsLoading, setFlowsLoading] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, FlowRole>>({});
  const { organization, profile } = useProfile();

  // Load flows for the org when dialog opens
  useEffect(() => {
    if (!open || !organization?.id) return;
    let cancelled = false;
    (async () => {
      setFlowsLoading(true);
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name, icon")
        .eq("organization_id", organization.id)
        .order("name");
      if (cancelled) return;
      if (error) {
        console.error("Error loading flows:", error);
        setFlows([]);
      } else {
        setFlows((data ?? []) as FlowOption[]);
      }
      setFlowsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organization?.id]);

  const toggleFlow = (flowId: string, checked: boolean) => {
    setAssignments((prev) => {
      const next = { ...prev };
      if (checked) {
        next[flowId] = next[flowId] ?? "member";
      } else {
        delete next[flowId];
      }
      return next;
    });
  };

  const setFlowRole = (flowId: string, value: FlowRole) => {
    setAssignments((prev) => ({ ...prev, [flowId]: value }));
  };

  const resetForm = () => {
    setEmail("");
    setRole("member");
    setAssignments({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organization || !profile) {
      toast.error("Organization or profile not found");
      return;
    }

    if (!email || !role) {
      toast.error("Please fill in all fields");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    const pipelineAssignments = Object.entries(assignments).map(([pipeline_id, r]) => ({
      pipeline_id,
      role: r,
    }));

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke("create-invitation", {
        body: {
          email: email.toLowerCase(),
          role,
          organizationId: organization.id,
          pipelineAssignments,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to create invitation");

      const flowsCount = pipelineAssignments.length;
      toast.success(
        flowsCount > 0
          ? `Invitation sent to ${email} with access to ${flowsCount} flow${flowsCount === 1 ? "" : "s"}.`
          : `Invitation sent to ${email}!`
      );
      resetForm();
      onInviteSent();
    } catch (err: any) {
      console.error("Error sending invitation:", err);
      toast.error(err?.message || "Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const selectedCount = Object.keys(assignments).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to add a new member to your team. They'll receive an email with instructions to join.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Organization Role</Label>
            <Select value={role} onValueChange={setRole} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Leader</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === "admin"
                ? "Can manage team members and access all features."
                : "Can access flows and contacts but cannot manage team."}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Add to Flows
              </Label>
              {selectedCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedCount} selected
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Pre-assign this member to flows so they can jump in right away.
            </p>

            <div className="rounded-md border bg-muted/30">
              {flowsLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading flows…</div>
              ) : flows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No flows yet. You can add this member to flows later.
                </div>
              ) : (
                <ScrollArea className="max-h-56">
                  <div className="divide-y">
                    {flows.map((flow) => {
                      const checked = !!assignments[flow.id];
                      const flowRole = assignments[flow.id] ?? "member";
                      return (
                        <div
                          key={flow.id}
                          className="flex items-center gap-3 px-3 py-2"
                        >
                          <Checkbox
                            id={`flow-${flow.id}`}
                            checked={checked}
                            onCheckedChange={(v) => toggleFlow(flow.id, !!v)}
                          />
                          <FlowIconBadge
                            flow={{ name: flow.name, icon: flow.icon || "Users" }}
                            size="sm"
                            showTooltip={false}
                          />
                          <label
                            htmlFor={`flow-${flow.id}`}
                            className="flex-1 cursor-pointer text-sm font-medium truncate"
                          >
                            {flow.name}
                          </label>
                          {checked && (
                            <Select
                              value={flowRole}
                              onValueChange={(v) => setFlowRole(flow.id, v as FlowRole)}
                            >
                              <SelectTrigger className="h-7 w-[130px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">Contributor</SelectItem>
                                <SelectItem value="lead">Leader</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, ArrowRight, FileSpreadsheet, Link2, Loader2, UserPlus, ClipboardList, Workflow } from "lucide-react";
import { useDemoMode } from "@/hooks/useDemoMode";
import { FlowTemplatePicker } from "@/components/flows/FlowTemplatePicker";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Two-step "Set Up My Church": confirm removing sample data, then pick a path.
 * Path A = Planning Center church. Path B = church without Planning Center.
 */
export const SetUpChurchDialog = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const { clearDemoData, isClearing } = useDemoMode();
  const [step, setStep] = useState<"confirm" | "choose">("confirm");
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const handleConfirm = async () => {
    try {
      await clearDemoData();
      setStep("choose");
    } catch {
      /* toast handled in hook */
    }
  };

  const go = (path: string) => {
    onOpenChange(false);
    setStep("confirm");
    navigate(path);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setStep("confirm");
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {step === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle>Set up your church</DialogTitle>
              <DialogDescription>
                This removes all sample people, flows, groups and activity so you can start with your own
                church. This can't be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span className="text-muted-foreground">
                Only sample data is deleted. Your account, team and settings stay exactly as they are.
              </span>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Keep exploring
              </Button>
              <Button onClick={handleConfirm} disabled={isClearing}>
                {isClearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove sample data
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add your people</DialogTitle>
              <DialogDescription>How would you like to get started?</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Set up your flows
                </p>
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => setTemplatesOpen(true)}
                  onKeyDown={(e) => e.key === "Enter" && setTemplatesOpen(true)}
                  className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-accent"
                >
                  <Workflow className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Start from a template</p>
                    <p className="text-xs text-muted-foreground">
                      Pick the follow-up flows your church runs — guests, care, baptism and more.
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Card>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Planning Center church
                </p>
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => go("/integrations")}
                  onKeyDown={(e) => e.key === "Enter" && go("/integrations")}
                  className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-accent"
                >
                  <Link2 className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Connect Planning Center</p>
                    <p className="text-xs text-muted-foreground">
                      Sync your people, check-ins and groups automatically.
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Card>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Church without Planning Center
                </p>
                {[
                  {
                    icon: FileSpreadsheet,
                    title: "Import a CSV",
                    desc: "Bring in a spreadsheet of people and map the columns.",
                    path: "/contacts?import=csv",
                  },
                  {
                    icon: UserPlus,
                    title: "Add people manually",
                    desc: "Start with the handful of people you're following up with.",
                    path: "/contacts?add=1",
                  },
                  {
                    icon: ClipboardList,
                    title: "Create your first form",
                    desc: "Share a signup link and let people add themselves.",
                    path: "/forms",
                  },
                ].map((opt) => (
                  <Card
                    key={opt.title}
                    role="button"
                    tabIndex={0}
                    onClick={() => go(opt.path)}
                    onKeyDown={(e) => e.key === "Enter" && go(opt.path)}
                    className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-accent"
                  >
                    <opt.icon className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{opt.title}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Card>
                ))}
              </div>
            </div>

            <FlowTemplatePicker open={templatesOpen} onOpenChange={setTemplatesOpen} />

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                I'll decide later
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

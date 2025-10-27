import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UserCircle, Layers, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MemberOnboardingProgress } from "@/hooks/useMemberOnboarding";

interface MemberOnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: MemberOnboardingProgress;
}

const steps = [
  {
    id: "profile_completed",
    title: "Complete Your Profile",
    description: "Add your name and photo so your team can recognize you.",
    icon: UserCircle,
    action: "Complete Profile",
    route: "/profile",
  },
  {
    id: "flows_reviewed",
    title: "Review Your Assigned Flows",
    description: "See which flows you'll help manage. Each flow represents a different ministry area.",
    icon: Layers,
    action: "View My Flows",
    route: "/",
  },
  {
    id: "first_interaction",
    title: "Explore a Flow",
    description: "Click into a flow to see how contacts move through stages and how you can interact with them.",
    icon: Sparkles,
    action: "Explore Flows",
    route: "/",
  },
];

export const MemberOnboardingWizard = ({
  open,
  onOpenChange,
  progress,
}: MemberOnboardingWizardProps) => {
  const navigate = useNavigate();

  const completedSteps = Object.values(progress).filter(Boolean).length;
  const percentage = (completedSteps / steps.length) * 100;

  const nextIncompleteStep = steps.find(
    (step) => !progress[step.id as keyof MemberOnboardingProgress]
  );

  const handleAction = (route: string) => {
    onOpenChange(false);
    navigate(route);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Welcome to the Team! 👋</DialogTitle>
          <DialogDescription>
            Let's get you started with FlowLeed in 3 quick steps
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {completedSteps} of {steps.length} completed
              </span>
              <span className="font-medium">{Math.round(percentage)}%</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step) => {
              const Icon = step.icon;
              const isCompleted = progress[step.id as keyof MemberOnboardingProgress];
              const isCurrent = step.id === nextIncompleteStep?.id;

              return (
                <div
                  key={step.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isCompleted
                      ? "bg-primary/5 border-primary/20"
                      : isCurrent
                      ? "bg-accent/50 border-primary"
                      : "bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-full p-2 ${
                        isCompleted
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                      {!isCompleted && isCurrent && (
                        <Button
                          size="sm"
                          onClick={() => handleAction(step.route)}
                        >
                          {step.action}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

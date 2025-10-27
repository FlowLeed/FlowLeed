import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Rocket, Users, Workflow, Database, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { OwnerOnboardingProgress } from "@/hooks/useOrgOwnerOnboarding";

interface OwnerOnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: OwnerOnboardingProgress;
}

const steps = [
  {
    id: "first_flow_created",
    title: "Create Your First Flow",
    description: "Flows help you track people through different stages of their journey. Create your first flow to get started.",
    icon: Workflow,
    action: "Create Flow",
    route: "/",
  },
  {
    id: "pco_connected",
    title: "Connect Planning Center",
    description: "Connect your Planning Center account to automatically sync your lists and contacts.",
    icon: Database,
    action: "Connect PCO",
    route: "/integrations",
  },
  {
    id: "pco_lists_mapped",
    title: "Map PCO Lists to Flows",
    description: "Map your PCO lists to flows so contacts are automatically added to the right journey.",
    icon: Workflow,
    action: "Map Lists",
    route: "/integrations",
  },
  {
    id: "team_members_invited",
    title: "Invite Your Team",
    description: "Invite staff, volunteers, or team leaders to collaborate in FlowLeed.",
    icon: Users,
    action: "Invite Team",
    route: "/team",
  },
  {
    id: "flow_owners_assigned",
    title: "Assign Flow Owners",
    description: "Assign team members to specific flows so they can track and manage contacts.",
    icon: UserPlus,
    action: "Assign Owners",
    route: "/",
  },
];

export const OwnerOnboardingWizard = ({
  open,
  onOpenChange,
  progress,
}: OwnerOnboardingWizardProps) => {
  const navigate = useNavigate();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const completedSteps = Object.entries(progress).filter(([_, value]) => value).length;
  const percentage = (completedSteps / steps.length) * 100;

  const currentStep = steps[currentStepIndex];
  const isCurrentStepCompleted = progress[currentStep.id as keyof OwnerOnboardingProgress];

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleAction = () => {
    onOpenChange(false);
    navigate(currentStep.route);
  };

  const Icon = currentStep.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Welcome to FlowLeed!
          </DialogTitle>
          <DialogDescription>
            Let's get your organization set up in {steps.length} easy steps
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
              <span className="font-medium">{Math.round(percentage)}% Complete</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>

          {/* Current Step */}
          <div className="p-6 rounded-lg border bg-card space-y-4">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{currentStep.title}</h3>
                  {isCurrentStepCompleted && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <p className="text-muted-foreground">{currentStep.description}</p>
              </div>
            </div>

            {!isCurrentStepCompleted && (
              <Button onClick={handleAction} className="w-full">
                {currentStep.action}
              </Button>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStepIndex === 0}
            >
              Previous
            </Button>
            <div className="flex gap-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    index === currentStepIndex
                      ? "bg-primary"
                      : index < currentStepIndex
                      ? "bg-primary/50"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <Button
              onClick={handleNext}
              disabled={currentStepIndex === steps.length - 1}
            >
              Next
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            I'll do this later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

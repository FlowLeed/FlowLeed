import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingProgressBarProps {
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  onDismiss?: () => void;
  className?: string;
}

export const OnboardingProgressBar = ({
  currentStep,
  totalSteps,
  completedSteps,
  onDismiss,
  className,
}: OnboardingProgressBarProps) => {
  const percentage = (completedSteps / totalSteps) * 100;

  return (
    <div className={cn("bg-card border-b px-6 py-3 animate-fade-in", className)}>
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Getting Started</span>
              <span className="text-xs text-muted-foreground">
                {completedSteps} of {totalSteps} completed
              </span>
            </div>
            <span className="text-sm font-semibold text-primary">{Math.round(percentage)}%</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

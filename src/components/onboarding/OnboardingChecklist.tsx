import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface OnboardingChecklistProps {
  title: string;
  description: string;
  checklist: ChecklistItem[];
  className?: string;
}

export const OnboardingChecklist = ({
  title,
  description,
  checklist,
  className,
}: OnboardingChecklistProps) => {
  return (
    <Card className={cn("animate-fade-in", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {checklist.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border transition-all",
              item.completed
                ? "bg-primary/5 border-primary/20"
                : "bg-card hover:bg-accent/50"
            )}
          >
            <div className="mt-0.5">
              {item.completed ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h4
                  className={cn(
                    "font-medium text-sm",
                    item.completed && "text-muted-foreground line-through"
                  )}
                >
                  {item.title}
                </h4>
              </div>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
            {item.action && !item.completed && (
              <Button
                size="sm"
                variant="outline"
                onClick={item.action.onClick}
                className="shrink-0"
              >
                {item.action.label}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

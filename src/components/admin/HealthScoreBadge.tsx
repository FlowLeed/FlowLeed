import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HealthScoreBadgeProps {
  score: number | null;
  showTooltip?: boolean;
}

export const HealthScoreBadge = ({ score, showTooltip = true }: HealthScoreBadgeProps) => {
  if (score === null || score === undefined) {
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        N/A
      </Badge>
    );
  }

  const getScoreData = (score: number) => {
    if (score >= 80) {
      return {
        label: "Healthy",
        variant: "default" as const,
        className: "bg-green-500 hover:bg-green-600 text-white border-green-500",
        emoji: "🟢"
      };
    } else if (score >= 60) {
      return {
        label: "Fair",
        variant: "secondary" as const,
        className: "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500",
        emoji: "🟡"
      };
    } else if (score >= 40) {
      return {
        label: "At Risk",
        variant: "secondary" as const,
        className: "bg-orange-500 hover:bg-orange-600 text-white border-orange-500",
        emoji: "🟠"
      };
    } else {
      return {
        label: "Unhealthy",
        variant: "destructive" as const,
        className: "bg-red-500 hover:bg-red-600 text-white border-red-500",
        emoji: "🔴"
      };
    }
  };

  const scoreData = getScoreData(score);

  const badge = (
    <Badge variant={scoreData.variant} className={scoreData.className}>
      {scoreData.emoji} {score} - {scoreData.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-sm">
            <p className="font-semibold">Health Score: {score}/100</p>
            <p className="text-muted-foreground">
              {score >= 80 && "Actively using, integrated, consistent pastoral activity"}
              {score >= 60 && score < 80 && "Some engagement, but low follow-up or AI use"}
              {score >= 40 && score < 60 && "Dropping usage, missing syncs, no new flows"}
              {score < 40 && "Inactive or stuck in onboarding"}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity } from 'lucide-react';
import type { EngagementScore } from '@/hooks/useCheckinData';

interface EngagementBadgeProps {
  score: EngagementScore | null | undefined;
  compact?: boolean;
}

const levelConfig: Record<string, { label: string; className: string }> = {
  highly_engaged: {
    label: 'Highly Engaged',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800',
  },
  active: {
    label: 'Active',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  at_risk: {
    label: 'At Risk',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  inactive: {
    label: 'Inactive',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800',
  },
  new: {
    label: 'New',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export function EngagementBadge({ score, compact = false }: EngagementBadgeProps) {
  if (!score) return null;

  const config = levelConfig[score.engagement_level] || levelConfig.new;

  const tooltipContent = [
    `Score: ${score.score}/100`,
    `${score.weeks_attended_last_12} of last 12 weeks attended`,
    score.streak_weeks > 0 ? `${score.streak_weeks}-week streak` : null,
    score.volunteer_checkins_90d > 0 ? `Volunteers regularly (${score.volunteer_checkins_90d}× in 90d)` : null,
    score.last_checkin_at
      ? `Last check-in: ${new Date(score.last_checkin_at).toLocaleDateString()}`
      : null,
  ].filter(Boolean).join(' · ');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`${config.className} gap-1 text-xs cursor-default`}>
            <Activity className="h-3 w-3" />
            {compact ? score.score : config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity, PauseCircle } from 'lucide-react';
import type { EngagementScore } from '@/hooks/useCheckinData';
import { useEngagementSettings } from '@/hooks/useEngagementSettings';
import { breakdownParts, DEFAULT_LABELS, type EngagementLevelKey } from '@/lib/engagementSettings';
import { useActiveLifeSeasons } from '@/hooks/useLifeSeason';
import { lifeSeasonLabel } from '@/lib/lifeSeasons';

interface EngagementBadgeProps {
  score: (EngagementScore & { score_breakdown?: any; consecutive_streak_weeks?: number }) | null | undefined;
  compact?: boolean;
  /** When provided, a pause mark shows if this person is in a life season. */
  contactId?: string;
}

const levelClassName: Record<string, string> = {
  highly_engaged:
    'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800',
  active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  at_risk: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  inactive: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800',
  new: 'bg-muted text-muted-foreground border-border',
};

export function EngagementBadge({ score, compact = false, contactId }: EngagementBadgeProps) {
  const { settings } = useEngagementSettings();
  const { data: seasons } = useActiveLifeSeasons();
  const season = contactId ? (seasons ?? []).find((s) => s.contact_id === contactId) : undefined;

  if (!score) return null;

  const level = (score.engagement_level as EngagementLevelKey) ?? 'new';
  const className = levelClassName[level] ?? levelClassName.new;
  const label = settings.labels?.[level] ?? DEFAULT_LABELS[level] ?? DEFAULT_LABELS.new;
  const weeksWindow = settings.windows.consistency_weeks;
  const streak = score.consecutive_streak_weeks ?? score.streak_weeks;
  const parts = breakdownParts(score.score_breakdown);

  const summary = [
    `Score: ${score.score}/100`,
    `${score.weeks_attended_last_12} of last ${weeksWindow} weeks attended`,
    streak > 0 ? `${streak}-week streak` : null,
    score.volunteer_checkins_90d > 0
      ? `Serving (${score.volunteer_checkins_90d}× in ${settings.windows.serving_days}d)`
      : null,
    score.last_checkin_at ? `Last check-in: ${new Date(score.last_checkin_at).toLocaleDateString()}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`${className} gap-1 text-xs cursor-default`}>
            <Activity className="h-3 w-3" />
            {compact ? score.score : label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs space-y-1">
          <p className="text-xs">{summary}</p>
          {parts.length > 0 && (
            <ul className="space-y-0.5 text-xs">
              {parts.map((part) => (
                <li key={part.key} className="flex justify-between gap-3">
                  <span>{part.label}</span>
                  <span>
                    {Math.round(part.earned)}/{Math.round(part.max)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PauseCircle, Play } from 'lucide-react';
import { format } from 'date-fns';
import { useLifeSeason } from '@/hooks/useLifeSeason';
import { lifeSeasonLabel } from '@/lib/lifeSeasons';
import { PauseEngagementDialog } from '@/components/contact/PauseEngagementDialog';

interface LifeSeasonBannerProps {
  contactId: string;
  contactName?: string;
}

export function LifeSeasonBanner({ contactId, contactName }: LifeSeasonBannerProps) {
  const { season, end } = useLifeSeason(contactId);
  const [editOpen, setEditOpen] = useState(false);

  if (!season) return null;

  return (
    <>
      <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Engagement paused — {lifeSeasonLabel(season.reason)} since{' '}
              {format(new Date(season.started_on), 'MMM d, yyyy')}
            </p>
            {season.note && <p className="text-amber-800/80 dark:text-amber-200/70">{season.note}</p>}
            <p className="text-xs text-amber-800/70 dark:text-amber-200/60">
              {contactName ? `${contactName.split(' ')[0]} stays` : 'They stay'} out of attention lists and the daily
              email while paused.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button size="sm" onClick={() => end.mutate(undefined)} disabled={end.isPending}>
            <Play className="mr-1 h-3.5 w-3.5" />
            End season
          </Button>
        </div>
      </div>
      <PauseEngagementDialog open={editOpen} onOpenChange={setEditOpen} contactId={contactId} mode="edit" />
    </>
  );
}

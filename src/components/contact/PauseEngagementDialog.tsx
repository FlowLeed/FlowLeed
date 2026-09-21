import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLifeSeason } from '@/hooks/useLifeSeason';
import { LIFE_SEASON_REASONS, type LifeSeasonReason } from '@/lib/lifeSeasons';

interface PauseEngagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName?: string;
  mode?: 'start' | 'edit';
}

export function PauseEngagementDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  mode = 'start',
}: PauseEngagementDialogProps) {
  const { season, start, update } = useLifeSeason(contactId);
  const [reason, setReason] = useState<LifeSeasonReason>('sick');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && season) {
      setReason((season.reason as LifeSeasonReason) ?? 'other');
      setNote(season.note ?? '');
    } else {
      setReason('sick');
      setNote('');
    }
  }, [open, mode, season]);

  const pending = start.isPending || update.isPending;

  const handleSave = async () => {
    if (mode === 'edit') {
      await update.mutateAsync({ reason, note });
    } else {
      await start.mutateAsync({ reason, note });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit life season' : 'Pause engagement'}</DialogTitle>
          <DialogDescription>
            {contactName ? `${contactName}'s` : 'This person’s'} engagement score is held where it is, and they are left
            out of attention lists and the daily email until you end the season. We will check in with you every 30
            days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as LifeSeasonReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIFE_SEASON_REASONS.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Surgery in March, back in about 8 weeks"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {mode === 'edit' ? 'Save changes' : 'Pause engagement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

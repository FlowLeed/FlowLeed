import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { useImpersonation } from '@/hooks/useImpersonation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface StartImpersonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  targetUserId: string;
}

export const StartImpersonationDialog = ({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  targetUserId,
}: StartImpersonationDialogProps) => {
  const [reason, setReason] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const { startImpersonation } = useImpersonation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleStart = async () => {
    if (!reason || reason.trim().length < 10) {
      toast.error('Please provide a detailed reason (at least 10 characters)');
      return;
    }

    if (!user) {
      toast.error('Authentication error');
      return;
    }

    setIsStarting(true);

    try {
      const result = await startImpersonation(
        organizationId,
        organizationName,
        targetUserId,
        reason.trim(),
        user.id
      );

      if (result.success) {
        toast.success('Impersonation session started');
        // Force page reload to trigger auth context update
        window.location.href = '/';
      } else {
        toast.error(`Failed to start impersonation: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Start Impersonation Session
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>You are about to impersonate:</p>
            <p className="font-semibold text-foreground">{organizationName}</p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
            <p className="font-semibold">⚠️ Important:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>All actions will be logged and audited</li>
              <li>Session expires after 4 hours</li>
              <li>You will act as the organization owner</li>
              <li>A visible banner will show during impersonation</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for Impersonation <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="e.g., Investigating reported sync issue with Planning Center integration..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Minimum 10 characters. Be specific about the issue you're investigating.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isStarting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={isStarting || reason.trim().length < 10}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isStarting ? 'Starting...' : 'Start Impersonation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

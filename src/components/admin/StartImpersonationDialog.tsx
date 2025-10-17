import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useImpersonation } from '@/hooks/useImpersonation';

interface StartImpersonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  adminName: string;
  adminEmail: string;
}

const REASON_OPTIONS = [
  { value: 'customer_support', label: 'Customer Support' },
  { value: 'onboarding_help', label: 'Onboarding Help' },
  { value: 'debugging_issue', label: 'Debugging Issue' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other (specify)' },
];

export const StartImpersonationDialog = ({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  adminName,
  adminEmail,
}: StartImpersonationDialogProps) => {
  const [reasonCategory, setReasonCategory] = useState('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [loading, setLoading] = useState(false);
  const { startImpersonation } = useImpersonation();

  const handleSubmit = async () => {
    if (!reasonCategory || !understood) return;

    const fullReason = reasonCategory === 'other' 
      ? reasonDetails 
      : `${REASON_OPTIONS.find(r => r.value === reasonCategory)?.label}${reasonDetails ? `: ${reasonDetails}` : ''}`;

    if (!fullReason.trim()) return;

    setLoading(true);
    try {
      await startImpersonation(organizationId, fullReason);
      // Dialog will close and page will redirect
    } catch (error) {
      setLoading(false);
      // Error is handled in the hook
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReasonCategory('');
      setReasonDetails('');
      setUnderstood(false);
      onOpenChange(false);
    }
  };

  const isValid = reasonCategory && understood && (reasonCategory !== 'other' || reasonDetails.trim());

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Start Impersonation Session</DialogTitle>
          <DialogDescription>
            You are about to view this organization as their admin
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Organization Info */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div>
              <div className="text-sm font-medium">Organization</div>
              <div className="text-sm text-muted-foreground">{organizationName}</div>
            </div>
            <div>
              <div className="text-sm font-medium">Admin</div>
              <div className="text-sm text-muted-foreground">
                {adminName} ({adminEmail})
              </div>
            </div>
          </div>

          {/* Reason Category */}
          <div className="space-y-2">
            <Label htmlFor="reason-category">Reason for Impersonation *</Label>
            <Select value={reasonCategory} onValueChange={setReasonCategory}>
              <SelectTrigger id="reason-category">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason Details */}
          <div className="space-y-2">
            <Label htmlFor="reason-details">
              Additional Details {reasonCategory === 'other' && '*'}
            </Label>
            <Textarea
              id="reason-details"
              placeholder="Provide specific details about why you need to access this organization..."
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              rows={3}
            />
          </div>

          {/* Security Warning */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Security Notice:</strong> You will have full access to this organization's data.
              All actions will be logged for compliance and audit purposes.
            </AlertDescription>
          </Alert>

          {/* Confirmation Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="understood"
              checked={understood}
              onCheckedChange={(checked) => setUnderstood(checked as boolean)}
            />
            <Label
              htmlFor="understood"
              className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I understand and acknowledge the security implications
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || loading}>
            {loading ? 'Starting...' : 'Start Impersonation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

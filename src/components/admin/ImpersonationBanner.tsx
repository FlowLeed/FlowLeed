import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImpersonation } from '@/hooks/useImpersonation';

export const ImpersonationBanner = () => {
  const { isImpersonating, session, endImpersonation } = useImpersonation();

  if (!isImpersonating || !session) return null;

  return (
    <div className="w-full bg-destructive text-destructive-foreground px-4 py-3 flex items-center justify-between gap-4 shadow-lg z-50">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="font-semibold">
            🔒 Impersonating: {session.targetOrgName}
          </span>
          <span className="text-sm opacity-90">
            Reason: {session.reason}
          </span>
        </div>
      </div>
      <Button
        onClick={endImpersonation}
        variant="secondary"
        size="sm"
        className="flex-shrink-0"
      >
        End Impersonation
      </Button>
    </div>
  );
};

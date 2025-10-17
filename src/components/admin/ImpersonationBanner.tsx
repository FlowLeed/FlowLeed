import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useImpersonationContext } from '@/contexts/ImpersonationContext';

export const ImpersonationBanner = () => {
  const { isImpersonating, impersonatedOrg, impersonatedOrgOwner, endImpersonation } = useImpersonationContext();
  const [sessionDuration, setSessionDuration] = useState('0:00');

  useEffect(() => {
    if (!isImpersonating) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setSessionDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [isImpersonating]);

  if (!isImpersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-destructive text-destructive-foreground px-4 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5" />
        <span className="font-semibold">
          ⚠️ SUPPORT MODE: Viewing as {impersonatedOrg?.name} ({impersonatedOrgOwner?.full_name || impersonatedOrgOwner?.email})
        </span>
        <Badge variant="outline" className="bg-background/20 text-destructive-foreground border-destructive-foreground/20">
          {sessionDuration}
        </Badge>
      </div>
      <Button
        variant="outline"
        className="bg-background text-destructive hover:bg-background/90 border-destructive-foreground/20"
        onClick={endImpersonation}
      >
        Exit Impersonation
      </Button>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/hooks/useImpersonation';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const LOADING_TIMEOUT_MS = 8000; // 8 seconds

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { isImpersonating, endImpersonation } = useImpersonation();
  const [showRecoveryPanel, setShowRecoveryPanel] = useState(false);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.error('[ProtectedRoute] Loading timeout - showing recovery panel');
        setShowRecoveryPanel(true);
      }, LOADING_TIMEOUT_MS);

      return () => clearTimeout(timer);
    } else {
      setShowRecoveryPanel(false);
    }
  }, [loading]);

  const handleClearCacheAndRetry = () => {
    console.log('[ProtectedRoute] Clearing cache and reloading');
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  if (loading && !showRecoveryPanel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (showRecoveryPanel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md p-6 border border-border rounded-lg bg-card text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">Loading Issue Detected</h2>
          <p className="text-sm text-muted-foreground">
            The application is taking longer than expected to load. This might be due to a session conflict or cached data.
          </p>
          <div className="space-y-2">
            {isImpersonating && (
              <Button onClick={endImpersonation} variant="destructive" className="w-full">
                End Impersonation
              </Button>
            )}
            <Button onClick={handleClearCacheAndRetry} variant="outline" className="w-full">
              Clear Cache and Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
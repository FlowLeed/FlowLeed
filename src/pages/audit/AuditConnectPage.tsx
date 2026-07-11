import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import flowleedLogo from '@/assets/flowleed_logo_new.png';

const AuditConnectPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { organization, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [hasIntegration, setHasIntegration] = useState<boolean | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/audit', { replace: true });
  }, [authLoading, user, navigate]);

  // Check for existing PCO integration
  useEffect(() => {
    if (!organization?.id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('integrations')
        .select('id, status')
        .eq('organization_id', organization.id)
        .eq('service_name', 'planning_center')
        .maybeSingle();
      setHasIntegration(!!data && data.status !== 'reauth_required');
    })();
  }, [organization?.id]);

  const startAudit = async () => {
    if (!organization?.id) return;
    setStarting(true);
    const { data, error } = await supabase.functions.invoke('run-church-audit', {
      body: { organizationId: organization.id },
    });
    if (error || !data?.reportId) {
      toast.error(error?.message || 'Failed to start audit');
      setStarting(false);
      return;
    }
    navigate(`/audit/generating?id=${data.reportId}`);
  };

  const connectPco = async () => {
    if (!organization?.id) return;
    setStarting(true);
    // Mark that we're mid-audit so the PCO callback can route back here
    sessionStorage.setItem('audit_intent', '1');
    let topOrigin = window.location.origin;
    try { if (window.top?.location.origin) topOrigin = window.top.location.origin; } catch { /* cross-origin */ }
    try {
      const { data, error } = await supabase.functions.invoke('pco-oauth-start', {
        body: { organizationId: organization.id, purpose: 'org', redirectOrigin: topOrigin },
      });
      if (error || !data?.authorizeUrl) throw new Error(data?.error || error?.message || 'Failed to start');
      try {
        if (window.top) window.top.location.href = data.authorizeUrl;
        else window.location.href = data.authorizeUrl;
      } catch { window.location.href = data.authorizeUrl; }
    } catch (e) {
      toast.error((e as Error).message);
      setStarting(false);
    }
  };

  const isLoading = authLoading || profileLoading || hasIntegration === null;

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="flex items-center justify-center mb-8">
          <img src={flowleedLogo} alt="Flowleed" className="h-8" />
        </div>
        <Card className="shadow-lg">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">One step to your Church Health Report</h1>
            <p className="text-muted-foreground">
              Connect Planning Center so we can analyze your people, groups and volunteers.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {hasIntegration ? (
                  <Button className="w-full" size="lg" onClick={startAudit} disabled={starting}>
                    {starting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Starting…</> : 'Generate my report →'}
                  </Button>
                ) : (
                  <Button className="w-full" size="lg" onClick={connectPco} disabled={starting}>
                    {starting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting…</> : 'Connect Planning Center'}
                  </Button>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  Want to skip this?{' '}
                  <button className="text-primary hover:underline" onClick={() => navigate('/')}>Go to my dashboard</button>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuditConnectPage;

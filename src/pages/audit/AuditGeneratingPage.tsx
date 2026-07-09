import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2, AlertTriangle, HeartPulse, Users2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import flowleedLogo from '@/assets/flowleed_logo_new.png';

const AuditGeneratingPage = () => {
  const [params] = useSearchParams();
  const reportId = params.get('id');
  const navigate = useNavigate();
  const [status, setStatus] = useState<'queued' | 'running' | 'ready' | 'failed' | 'unknown'>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!reportId) { navigate('/audit/connect', { replace: true }); return; }

    let cancelled = false;
    const startedAt = Date.now();

    const tick = async () => {
      const { data, error: e } = await supabase
        .from('church_health_reports')
        .select('status, error')
        .eq('id', reportId)
        .maybeSingle();
      if (cancelled) return;
      if (e || !data) return;
      setStatus(data.status as any);
      if (data.status === 'ready') {
        navigate(`/audit/report/${reportId}`, { replace: true });
      } else if (data.status === 'failed') {
        setError(data.error || 'Something went wrong generating the report.');
      }
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    };

    tick();
    const id = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [reportId, navigate]);

  const isFailed = status === 'failed';

  const steps = [
    { icon: HeartPulse, label: 'Analyzing at-risk people', done: elapsed > 3 || status === 'ready' },
    { icon: Users2, label: 'Reviewing leader & volunteer health', done: elapsed > 6 || status === 'ready' },
    { icon: Layers, label: 'Scoring groups health', done: elapsed > 9 || status === 'ready' },
  ];

  return (
    <div className="min-h-screen bg-background overflow-y-auto flex items-center">
      <div className="max-w-xl mx-auto px-4 py-16 w-full">
        <div className="flex items-center justify-center mb-8">
          <img src={flowleedLogo} alt="Flowleed" className="h-8" />
        </div>
        <Card className="shadow-lg">
          <CardContent className="pt-8 pb-8 space-y-6 text-center">
            {isFailed ? (
              <>
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
                <h1 className="text-xl font-semibold">We hit a snag</h1>
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button onClick={() => navigate('/audit/connect')} variant="outline">Try again</Button>
              </>
            ) : (
              <>
                <div className="relative mx-auto w-16 h-16">
                  <Loader2 className="h-16 w-16 animate-spin text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Building your report…</h1>
                  <p className="text-sm text-muted-foreground mt-1">This usually takes 10–30 seconds.</p>
                </div>
                <div className="space-y-3 text-left max-w-sm mx-auto">
                  {steps.map((s) => (
                    <div key={s.label} className="flex items-center gap-3 text-sm">
                      {s.done ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      )}
                      <s.icon className="h-4 w-4 text-muted-foreground" />
                      <span className={s.done ? 'text-foreground' : 'text-muted-foreground'}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuditGeneratingPage;

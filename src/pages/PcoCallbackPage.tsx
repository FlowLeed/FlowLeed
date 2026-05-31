import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function PcoCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const dedupeKey = `pco_cb_${state}`;
    if (state && sessionStorage.getItem(dedupeKey)) return;
    if (state) sessionStorage.setItem(dedupeKey, '1');

    const oauthError = params.get('error');

    if (oauthError) {
      setError(oauthError);
      toast.error(`Planning Center: ${oauthError}`);
      return;
    }
    if (!code || !state) {
      setError('Missing code or state');
      return;
    }

    (async () => {
      const { data, error } = await supabase.functions.invoke('pco-oauth-callback', {
        body: { code, state, redirectOrigin: window.location.origin },
      });
      let errBody: any = data;
      if (error && (error as any).context?.json) {
        try { errBody = await (error as any).context.json(); } catch {}
      } else if (error && (error as any).context?.text) {
        try { errBody = { error: await (error as any).context.text() }; } catch {}
      }
      if (error || errBody?.error) {
        const msg = errBody?.message || errBody?.detail || errBody?.error || error?.message || 'Connection failed';
        console.error('[pco-callback] failed', { error, errBody });
        setError(msg);
        toast.error(msg);
        return;
      }
      const where = data?.purpose === 'user' ? '/profile' : '/integrations';
      toast.success(
        data?.providerAccountName
          ? `Connected to ${data.providerAccountName}`
          : 'Planning Center connected',
      );
      navigate(where, { replace: true });
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-4">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Planning Center connection failed</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              className="text-primary underline text-sm"
              onClick={() => navigate('/integrations')}
            >
              Back to Integrations
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">
              Finishing Planning Center connection…
            </p>
          </>
        )}
      </div>
    </div>
  );
}

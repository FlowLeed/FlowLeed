import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Sparkles, HeartPulse, Users2, Layers, Loader2, AlertTriangle, Check, Lock, Eye, Database, Unplug } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import flowleedLogo from '@/assets/flowleed_logo_new.png';

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken';

// Public: short WHY + signup form. No landing content — that lives on flowleed.com.
const AuditSignupPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signedUp, setSignedUp] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [currentSlug, setCurrentSlug] = useState('');

  const { signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // If already signed in, jump straight to connect step.
  useEffect(() => {
    if (user) navigate('/audit/connect', { replace: true });
  }, [user, navigate]);

  // Capture utm/referrer on first mount, persist to sessionStorage so we can write
  // to the profile after email verification.
  useEffect(() => {
    const utm: Record<string, string> = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((k) => {
      const v = params.get(k);
      if (v) utm[k] = v;
    });
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem('audit_utm', JSON.stringify(utm));
    }
    if (document.referrer) sessionStorage.setItem('audit_referrer', document.referrer);
    sessionStorage.setItem('audit_intent', '1');
  }, [params]);

  const checkSlug = useCallback(async (name: string) => {
    if (!name || name.trim().length < 2) {
      setSlugStatus('idle');
      setSlugSuggestions([]);
      setCurrentSlug('');
      return;
    }
    setSlugStatus('checking');
    try {
      const { data, error } = await supabase.functions.invoke('check-org-slug', {
        body: { organizationName: name.trim() },
      });
      if (error) { setSlugStatus('idle'); return; }
      setCurrentSlug(data.slug);
      if (data.available) { setSlugStatus('available'); setSlugSuggestions([]); }
      else { setSlugStatus('taken'); setSlugSuggestions(data.suggestions || []); }
    } catch { setSlugStatus('idle'); }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => checkSlug(organizationName), 500);
    return () => clearTimeout(id);
  }, [organizationName, checkSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slugStatus === 'taken') { setError('Please pick an available organization name.'); return; }
    setError('');
    setLoading(true);
    const { error } = await signUp(email, password, fullName, organizationName);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSignedUp(true);
    setLoading(false);
    toast({ title: 'Account created', description: 'Check your email to verify your account, then continue below.' });
  };

  return (
    <div className="h-screen bg-background overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-10 md:py-16">
        <div className="flex items-center justify-center mb-8">
          <img src={flowleedLogo} alt="Flowleed" className="h-8" />
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* WHY */}
          <div className="space-y-6">
            <Badge variant="secondary" className="w-fit">
              <Sparkles className="h-3 w-3 mr-1" />
              Free · Takes 10 minutes
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
              Get your free <span className="text-primary">Church Health Report</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Connect Planning Center and we'll surface who's drifting, where your leaders are stretched, and which groups need attention — with names, not just numbers.
            </p>

            <ul className="space-y-3 text-sm">
              <li className="flex gap-3">
                <HeartPulse className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">At-risk & drifting people</div>
                  <div className="text-muted-foreground">See who quietly stopped showing up.</div>
                </div>
              </li>
              <li className="flex gap-3">
                <Users2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Volunteer & leader health</div>
                  <div className="text-muted-foreground">Workload distribution and leaders who need care.</div>
                </div>
              </li>
              <li className="flex gap-3">
                <Layers className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Groups health</div>
                  <div className="text-muted-foreground">Dormant groups, over capacity, missing co-leaders.</div>
                </div>
              </li>
            </ul>

            <div className="rounded-lg border p-4 bg-muted/30 space-y-3 text-sm">
              <div className="flex gap-3">
                <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Secure Planning Center Connection</div>
                  <div className="text-muted-foreground">
                    Connect through Planning Center's official authentication process. Your Planning Center password is never shared with or stored by FlowLeed.
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Eye className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Read-Only Access</div>
                  <div className="text-muted-foreground">
                    FlowLeed reads the information needed to give your team helpful insights. It does not change or delete your data in Planning Center.
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Database className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Your Data Stays Yours</div>
                  <div className="text-muted-foreground">
                    We don't sell your data or use it for advertising.
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Unplug className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Disconnect Anytime</div>
                  <div className="text-muted-foreground">
                    You stay in control. Disconnect FlowLeed from Planning Center whenever you choose.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Signup */}
          <Card className="shadow-lg">
            <CardHeader>
              <h2 className="text-xl font-semibold">Create your account</h2>
              <p className="text-sm text-muted-foreground">Next step: connect Planning Center.</p>
            </CardHeader>
            <CardContent>
              {signedUp ? (
                <div className="space-y-4 text-center py-4">
                  <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                  <h3 className="text-lg font-semibold">Check your inbox</h3>
                  <p className="text-sm text-muted-foreground">
                    We just sent a verification email to <span className="font-medium text-foreground">{email}</span>.
                    Click the link to verify, then you'll land on the Connect Planning Center step.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => navigate('/audit/connect')}>
                    I've verified — continue
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="au-name">Your name</Label>
                    <Input id="au-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="au-org">Church / Organization</Label>
                    <Input id="au-org" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required />
                    {slugStatus === 'checking' && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Checking…
                      </div>
                    )}
                    {slugStatus === 'available' && (
                      <div className="flex items-center gap-2 text-xs text-green-600">
                        <Check className="h-3 w-3" /> "{currentSlug}" is available
                      </div>
                    )}
                    {slugStatus === 'taken' && (
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="h-3 w-3" /> Taken. Try:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {slugSuggestions.map((s) => (
                            <Badge key={s} variant="outline" className="cursor-pointer" onClick={() => {
                              const readable = s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
                              setOrganizationName(readable);
                            }}>{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="au-email">Work email</Label>
                    <Input id="au-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="au-pass">Password</Label>
                    <Input id="au-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={loading || slugStatus === 'taken' || slugStatus === 'checking'}>
                    {loading ? 'Creating…' : 'Get my free report →'}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Already have an account?{' '}
                    <button type="button" className="text-primary hover:underline" onClick={() => navigate('/auth?mode=signin')}>
                      Sign in
                    </button>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AuditSignupPage;

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase, setRememberMe, getRememberMe } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import flowleedLogo from '@/assets/flowleed_logo_new.png';
import { Loader2, Check } from 'lucide-react';

const LEGAL_URL = 'http://flowleed.com/legal';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMeState] = useState<boolean>(() => getRememberMe());

  const { signIn, signUp, signInWithGoogle, resetPassword, updatePassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Set initial mode from URL ?mode=signup or ?mode=signin
  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'signup' || modeParam === 'signin') {
      setMode(modeParam);
    }
  }, [searchParams]);

  // Listen for PASSWORD_RECOVERY event from Supabase auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
    });

    // Also check URL hash on mount (Supabase sends #type=recovery in the URL)
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecoveryMode(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Persist preference BEFORE sign-in so the storage adapter writes to the correct store
    setRememberMe(rememberMe);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
    } else {
      toast({
        title: "Welcome back!",
        description: "You've been signed in successfully.",
      });
      navigate('/');
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await signUp(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    toast({
      title: 'Welcome to Flowleed!',
      description: 'Your account is ready.',
    });
    navigate('/');
    setLoading(false);
  };


  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError('');

    const { error } = await resetPassword(resetEmail);
    
    if (error) {
      setError(error.message);
      setResetSuccess(false);
    } else {
      setResetSuccess(true);
      toast({
        title: "Reset email sent!",
        description: "Check your email for password reset instructions.",
      });
    }
    
    setResetLoading(false);
  };

  const handleBackToSignIn = () => {
    setIsResetMode(false);
    setResetEmail('');
    setError('');
    setResetSuccess(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    const { error } = await updatePassword(newPassword);
    
    if (error) {
      setError(error.message);
    } else {
      toast({
        title: "Password updated!",
        description: "Your password has been successfully updated.",
      });
      navigate('/');
    }
    
    setLoading(false);
  };

  const googleButton = (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleGoogle}
      disabled={googleLoading || loading}
    >
      {googleLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <svg className="h-4 w-4 mr-2" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.54 28.59A14.5 14.5 0 0 1 9.8 24c0-1.6.27-3.14.74-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.98-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.31-8.16 2.31-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
      )}
      Continue with Google
    </Button>
  );

  const divider = (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-muted-foreground">or</span>
      </div>
    </div>
  );

  const legalNotice = (
    <p className="text-center text-xs text-muted-foreground">
      By continuing, you agree to our{' '}
      <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
        Terms of Use
      </a>{' '}
      and{' '}
      <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
        Privacy Policy
      </a>
      .
    </p>
  );

  const signUpBenefits = [
    'Start with sample church data',
    'Connect Planning Center later',
    'No credit card required',
  ];

  const signInCard = (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <img src={flowleedLogo} alt="Flowleed" className="h-8 mx-auto mb-2" />
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>
          Enter your details to sign in
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isResetMode ? (
          <div className="space-y-4">
            {googleButton}
            {divider}

            <form onSubmit={handleSignIn} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMeState(checked === true)}
                  />
                  <Label
                    htmlFor="remember-me"
                    className="text-sm font-normal cursor-pointer select-none"
                  >
                    Remember me
                  </Label>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResetMode(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot?
                </button>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="text-center text-sm pt-2">
              <span className="text-muted-foreground">Don't have an account? </span>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); }}
                className="text-primary hover:underline font-medium"
              >
                Create Account
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {resetSuccess ? (
              <div className="text-center space-y-4">
                <Alert>
                  <AlertDescription>
                    Password reset email sent! Check your inbox and follow the instructions to reset your password.
                  </AlertDescription>
                </Alert>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToSignIn}
                  className="w-full"
                >
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">Reset your password</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter your email and we'll send you a reset link
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email Address</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={resetLoading}>
                  {resetLoading ? 'Sending...' : 'Send Reset Email'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToSignIn}
                  className="w-full"
                >
                  Back to Sign In
                </Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const signUpCard = (
    <Card className="w-full max-w-2xl overflow-hidden">
      <div className="flex flex-col md:flex-row">
        <div className="md:w-60 bg-primary/5 border-b md:border-b-0 md:border-r border-border p-8 flex flex-col justify-between">
          <div>
            <img src={flowleedLogo} alt="Flowleed" className="h-7 mb-4" />
            <p className="text-sm text-muted-foreground mb-8">
              A Digital Co-Pastor that helps caring for people
            </p>
            <h3 className="text-lg font-semibold mb-2">Join Flowleed</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Start caring for your church community with smart follow-ups and clear insights.
            </p>
          </div>

          <ul className="mt-8 space-y-3">
            {signUpBenefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 text-primary" strokeWidth={3} />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tight">
                  {benefit}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex-1 p-8">
          <div className="mb-6">
            <CardTitle className="text-2xl">Create your free account</CardTitle>
            <CardDescription className="mt-1">
              Get started in seconds
            </CardDescription>
          </div>

          <div className="space-y-4">
            {googleButton}
            {divider}

            <form onSubmit={handleSignUp} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>

            {legalNotice}

            <div className="text-center text-sm pt-2">
              <span className="text-muted-foreground">Already have an account? </span>
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); }}
                className="text-primary hover:underline font-medium"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      {isRecoveryMode ? (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={flowleedLogo} alt="Flowleed" className="h-8 mx-auto mb-2" />
            <CardTitle className="text-2xl">Set New Password</CardTitle>
            <CardDescription>
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Updating password...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="transition-all duration-300 ease-in-out">
          {mode === 'signin' ? signInCard : signUpCard}
        </div>
      )}
    </div>
  );
};

export default AuthPage;

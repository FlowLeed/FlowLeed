import { useState, useEffect, useCallback } from 'react';
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
import { Check, AlertTriangle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);
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
  
  // Slug availability state
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [currentSlug, setCurrentSlug] = useState('');
  
  const { signIn, signUp, resetPassword, updatePassword } = useAuth();
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

  // Debounced slug check
  const checkSlugAvailability = useCallback(async (name: string) => {
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

      if (error) {
        console.error('Error checking slug:', error);
        setSlugStatus('idle');
        return;
      }

      setCurrentSlug(data.slug);
      if (data.available) {
        setSlugStatus('available');
        setSlugSuggestions([]);
      } else {
        setSlugStatus('taken');
        setSlugSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error('Error checking slug:', err);
      setSlugStatus('idle');
    }
  }, []);

  // Debounce organization name changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkSlugAvailability(organizationName);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [organizationName, checkSlugAvailability]);

  const handleSuggestionClick = (suggestion: string) => {
    // Convert slug back to readable name (e.g., "my-church-1" -> "My Church 1")
    const readableName = suggestion
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    setOrganizationName(readableName);
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
      setNeedsVerification(error.code === 'email_not_verified');
    } else {
      setNeedsVerification(false);
      toast({
        title: "Welcome back!",
        description: "You've been signed in successfully.",
      });
      navigate('/');
    }
    
    setLoading(false);
  };

  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (!email || resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-signup-confirmation', {
        body: { email, resend: true },
      });
      if (error) throw error;
      toast({
        title: 'Verification email sent',
        description: `We sent a fresh verification link to ${email}.`,
      });
      setResendCooldown(60);
    } catch (err: any) {
      toast({
        title: 'Could not send email',
        description: err?.message ?? 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setResendLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent submission if slug is taken
    if (slugStatus === 'taken') {
      setError('Please choose an available organization name before continuing.');
      return;
    }
    
    setLoading(true);
    setError('');

    const { error } = await signUp(email, password, fullName, organizationName);
    
    if (error) {
      // Check if it's a duplicate organization name error
      const errorMessage = error.message?.toLowerCase() || '';
      if (errorMessage.includes('duplicate') || 
          errorMessage.includes('organizations_slug_key') ||
          errorMessage.includes('unique constraint')) {
        setError('An organization with this name already exists. Please choose a different organization name.');
      } else {
        setError(error.message);
      }
    } else {
      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });
      // Stay on auth page to show verification message
    }
    
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

  const renderSlugStatus = () => {
    if (slugStatus === 'idle' || !organizationName.trim()) {
      return null;
    }

    if (slugStatus === 'checking') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Checking availability...</span>
        </div>
      );
    }

    if (slugStatus === 'available') {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600 mt-1">
          <Check className="h-3 w-3" />
          <span>"{currentSlug}" is available!</span>
        </div>
      );
    }

    if (slugStatus === 'taken') {
      return (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-3 w-3" />
            <span>This name is taken. Try one of these:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {slugSuggestions.map((suggestion) => (
              <Badge
                key={suggestion}
                variant="outline"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </Badge>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  const isSignUpDisabled = loading || slugStatus === 'taken' || slugStatus === 'checking';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={flowleedLogo} alt="Flowleed" className="h-8 mx-auto mb-2" />
          <CardDescription>
            A Digital Co‑Pastor that helps caring for people
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRecoveryMode ? (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Set New Password</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your new password below
                </p>
              </div>
              
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
            </div>
          ) : (
            <div className="w-full space-y-4">
              {mode === 'signin' ? (
                <div className="space-y-4">
                  {!isResetMode ? (
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

                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                      </Button>

                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => setIsResetMode(true)}
                          className="text-sm text-primary hover:underline"
                        >
                          Forgot your password?
                        </button>
                      </div>
                    </form>
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

                  <div className="text-center text-sm">
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
                  <form onSubmit={handleSignUp} className="space-y-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-org">Organization Name</Label>
                      <Input
                        id="signup-org"
                        type="text"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        required
                      />
                      {renderSlugStatus()}
                    </div>

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

                    <Button type="submit" className="w-full" disabled={isSignUpDisabled}>
                      {loading ? 'Creating account...' : 'Create Account'}
                    </Button>
                  </form>

                  <div className="text-center text-sm">
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
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;

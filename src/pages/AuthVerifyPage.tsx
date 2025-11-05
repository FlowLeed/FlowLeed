import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

type VerificationState = 'verifying' | 'success' | 'error' | 'password_reset';

export default function AuthVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [state, setState] = useState<VerificationState>('verifying');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  const token = searchParams.get('token');
  const type = searchParams.get('type');

  useEffect(() => {
    if (!token || !type) {
      setState('error');
      return;
    }

    verifyToken();
  }, [token, type]);

  const verifyToken = async () => {
    if (!token || !type) return;

    try {
      const { data, error } = await supabase.functions.invoke('verify-email-token', {
        body: { token, type },
      });

      if (error) {
        throw error;
      }

      if (type === 'password_reset') {
        setEmail(data.email);
        setState('password_reset');
      } else {
        setState('success');
        toast({
          title: 'Email verified!',
          description: 'You can now sign in to your account.',
        });
        
        // Redirect to auth page after 2 seconds
        setTimeout(() => {
          navigate('/auth');
        }, 2000);
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      setState('error');
      toast({
        title: 'Verification failed',
        description: error.message || 'The verification link is invalid or has expired.',
        variant: 'destructive',
      });
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are the same.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Call the reset-password edge function
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { email, password: newPassword },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Password updated!',
        description: 'Your password has been successfully reset.',
      });

      setTimeout(() => {
        navigate('/auth');
      }, 1000);
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        title: 'Failed to reset password',
        description: error.message || 'An error occurred while resetting your password.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {state === 'verifying' && (
            <>
              <div className="mx-auto mb-4 h-12 w-12 animate-spin">
                <Loader2 className="h-full w-full text-primary" />
              </div>
              <CardTitle>Verifying...</CardTitle>
              <CardDescription>Please wait while we verify your email</CardDescription>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="mx-auto mb-4 h-12 w-12 text-green-500">
                <CheckCircle2 className="h-full w-full" />
              </div>
              <CardTitle>Email Verified!</CardTitle>
              <CardDescription>Redirecting you to sign in...</CardDescription>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="mx-auto mb-4 h-12 w-12 text-destructive">
                <XCircle className="h-full w-full" />
              </div>
              <CardTitle>Verification Failed</CardTitle>
              <CardDescription>
                The verification link is invalid or has expired
              </CardDescription>
            </>
          )}

          {state === 'password_reset' && (
            <>
              <CardTitle>Reset Your Password</CardTitle>
              <CardDescription>Enter your new password below</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent>
          {state === 'error' && (
            <Button
              onClick={() => navigate('/auth')}
              className="w-full"
            >
              Back to Sign In
            </Button>
          )}

          {state === 'password_reset' && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

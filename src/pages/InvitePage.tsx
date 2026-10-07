import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Users, Mail } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import type { InvitationData } from '@shared/models/InvitationData';
import { getInvitationDetails } from '@/api/invitations';
import { ProviderError } from '@/errors/ProviderError';
import { PasswordInput } from '@/components/ui/password-input';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [signupComplete, setSignupComplete] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptedComplete, setAcceptedComplete] = useState(false);

  useEffect(() => {
    if (token && !signupComplete && !acceptedComplete) {
      fetchInvitation();
    }
  }, [token, signupComplete, acceptedComplete]);

  const fetchInvitation = async () => {
    try {
      // Robust token extraction - handles Resend tracking URLs, query params, etc.
      let extractedToken = token;
      if (!extractedToken) {
        const url = window.location.href;
        console.log('No param token, extracting from URL:', url);

        // Extract UUID from URL (handles /invite/TOKEN/clicks/... or /invite/TOKEN?...)
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const match = url.match(uuidRegex);

        if (match) {
          extractedToken = match[0];
          console.log('Extracted token from URL:', extractedToken);
        } else {
          console.error('No valid UUID token found in URL');
          setError('Invalid invitation link - no token found.');
          setLoading(false);
          return;
        }
      } else {
        console.log('Using token from route param:', extractedToken);
      }

      const invitationData = await getInvitationDetails(extractedToken);

      if (invitationData.accepted_at) {
        console.log('Invitation already accepted');

        // If user is signed in with the invited email, treat as success
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email?.toLowerCase() === invitationData.email.toLowerCase()) {
          toast({
            title: "Already a Member",
            description: `You're already part of ${invitationData.organization_name}`,
          });
          setAcceptedComplete(true);
          setTimeout(() => navigate('/dashboard'), 500);
          return;
        }

        // Otherwise, show error
        setError('This invitation has already been accepted.');
        return;
      }

      if (new Date(invitationData.expires_at) < new Date()) {
        setError('This invitation has expired.');
        return;
      }

      setInvitation(invitationData);
      setEmail(invitationData.email);

      // If a user already exists with this email, default to sign-in mode
      if (invitationData.user_exists) {
        setAuthMode('signin');
      }

      // Check if user needs to create an account or sign in
      if (!user || user.email !== invitationData.email) {
        setNeedsAccount(true);

        // If user is logged in but with wrong email, show message
        if (user && user.email !== invitationData.email) {
          setError(`You are currently signed in as ${user.email}, but this invitation is for ${invitationData.email}. Please sign out and sign in with the correct email.`);
        }
      }

    } catch (error) {
      console.error('Error in fetchInvitation:', error);
      setError(error instanceof ProviderError ? error.message : 'Failed to load invitation details.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;

    try {
      setAccepting(true);
      setError(null);

      if (authMode === 'signup') {
        // Use the edge function to create user without email confirmation
        const { data, error } = await supabase.functions.invoke('create-invited-user', {
          body: {
            token,
            email,
            password,
            fullName: fullName || email.split('@')[0]
          }
        });

        if (error) {
          setError(error.message);
          return;
        }

        if (data?.error) {
          setError(data.error);
          return;
        }

        if (data?.requiresSignIn) {
          // User already exists - switch to sign-in mode
          setAuthMode('signin');
          toast({
            title: "Account Already Exists",
            description: data.message || "Please sign in to accept the invitation.",
          });
          setError(null); // Clear any existing errors
          return;
        }

        // Success! User created and invitation accepted
        setSignupComplete(true);

        toast({
          title: "Welcome!",
          description: "Your account has been created and you've joined the organization.",
        });

        // Redirect to dashboard immediately without refetching
        setTimeout(() => navigate('/'), 500);
      } else {
        const { error } = await signIn(email, password);

        if (error) {
          console.error('Sign in error:', error);
          setAcceptError(error.message || "Failed to sign in. Please try again.");
          return;
        }

        // Verify session before accepting
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setAcceptError("Authentication failed. Please try again.");
          return;
        }

        console.log('Sign in successful, waiting for session to propagate...');
        // Small delay to ensure session is fully propagated to the client
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('Session ready, accepting invitation...');
        // After successful sign in, accept the invitation
        await acceptInvitation();
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError('Authentication failed. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const acceptInvitation = async () => {
    if (!invitation || !token) return;

    try {
      setAccepting(true);
      setAcceptError(null);

      console.log('Calling accept-invitation edge function with token:', token);

      // Get the current session and manually pass the auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setAcceptError("Authentication session not found. Please try signing in again.");
        return;
      }

      const { data, error } = await supabase.functions.invoke('accept-invitation', {
        body: { token },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Network/auth error accepting invitation:', error);
        const errorMessage = error.message || error.toString();

        if (errorMessage.includes('session') || errorMessage.includes('auth')) {
          setAcceptError('Authentication session expired. Please try signing in again.');
        } else {
          setAcceptError('Failed to connect. Please check your connection and try again.');
        }
        return;
      }

      if (data?.error) {
        console.error('Server error:', data.error);
        const errorMsg = data.error.toLowerCase();

        // Truly invalid cases - show global error
        if (errorMsg.includes('invalid') || errorMsg.includes('expired')) {
          setError(data.error);
          return;
        }

        // Already a member or already accepted - treat as success
        if (errorMsg.includes('already a member') || data.success) {
          console.log('User already a member, treating as success');
          setAcceptedComplete(true);
          localStorage.setItem('selectedOrganizationId', invitation.organization_id);
          toast({
            title: "Welcome!",
            description: data.message || "You're already a member of this organization",
          });
          setTimeout(() => navigate('/dashboard'), 300);
          return;
        }

        // Email mismatch or other retryable errors - inline
        setAcceptError(data.error);
        return;
      }

      // Success
      console.log('Invitation accepted successfully:', data);
      setAcceptedComplete(true);
      localStorage.setItem('selectedOrganizationId', invitation.organization_id);

      toast({
        title: "Success!",
        description: data.message || "Welcome to the team!",
      });

      setTimeout(() => navigate('/dashboard'), 300);

    } catch (err) {
      console.error('Unexpected error:', err);
      setAcceptError('An unexpected error occurred. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading invitation...</p>
        </div>
      </div>
    );
  }

  // Only show the global "Invalid Invitation" screen for invalid/expired/already-accepted tokens
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>

            {import.meta.env.DEV && (
              <div className="mt-4 p-3 bg-gray-100 rounded-md text-xs font-mono space-y-1">
                <div className="font-semibold mb-2 text-gray-700">Debug Info:</div>
                <div className="text-gray-600">Token (param): {token || 'none'}</div>
                <div className="text-gray-600">Full URL: {window.location.href}</div>
              </div>
            )}

            <Button
              className="w-full mt-4"
              onClick={() => navigate('/')}
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  // If user is authenticated and email matches, show accept button
  if (user && user.email === invitation.email && !needsAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Users className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <CardTitle>Team Invitation</CardTitle>
            <CardDescription>
              You've been invited to join {invitation.organization_name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {acceptError && (
              <Alert variant="destructive">
                <AlertDescription>{acceptError}</AlertDescription>
              </Alert>
            )}

            <div className="text-center space-y-2">
              <p><strong>Organization:</strong> {invitation.organization_name}</p>
              <p><strong>Invited by:</strong> {invitation.inviter_name}</p>
              <p><strong>Role:</strong> {invitation.role}</p>
              <p><strong>Email:</strong> {invitation.email}</p>
            </div>

            <Button
              onClick={acceptInvitation}
              disabled={accepting}
              className="w-full"
            >
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Accept Invitation
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show authentication form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Mail className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <CardTitle>Join {invitation.organization_name}</CardTitle>
          <CardDescription>
            {invitation.inviter_name} has invited you to join their team as a {invitation.role}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {acceptError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{acceptError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium mb-1">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={true} // Email is pre-filled from invitation
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <Button type="submit" disabled={accepting} className="w-full">
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {authMode === 'signup' ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                authMode === 'signup' ? 'Create Account & Accept' : 'Sign In & Accept'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
              className="text-sm text-blue-600 hover:underline"
            >
              {authMode === 'signin'
                ? "Don't have an account? Create one"
                : "Already have an account? Sign in"
              }
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
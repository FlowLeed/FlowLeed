import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Users, Mail } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface InvitationData {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  organization_name: string;
  inviter_name: string;
  expires_at: string;
  accepted_at: string | null;
}

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
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    if (token) {
      fetchInvitation();
    }
  }, [token]);

  const fetchInvitation = async () => {
    try {
      // Extract token from URL - handle Resend link tracking redirects
      const urlToken = token || new URL(window.location.href).pathname.split('/invite/')[1];
      console.log('Fetching invitation with token:', urlToken);
      
      // First try via Supabase invoke (POST)
      const { data: invitation, error: invokeError } = await supabase.functions.invoke('get-invitation-details', {
        body: { token: urlToken }
      });

      let invitationDataRaw: any = invitation;

      if (invokeError || !invitationDataRaw) {
        console.warn('Invoke failed or returned empty, falling back to GET fetch...', invokeError);
        // Fallback: direct GET call (helps in environments where invoke is blocked/misconfigured)
        const resp = await fetch(`https://lghamvpolwebtjwaxned.supabase.co/functions/v1/get-invitation-details?token=${urlToken}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error('GET fetch failed:', resp.status, errText);
          setError('Invalid or expired invitation link.');
          return;
        }
        invitationDataRaw = await resp.json();
      }

      if (!invitationDataRaw) {
        console.error('No invitation data returned after both attempts');
        setError('Invalid or expired invitation link.');
        return;
      }

      console.log('Invitation data received:', invitationDataRaw);

      if (invitationDataRaw.accepted_at) {
        setError('This invitation has already been accepted.');
        return;
      }

      if (new Date(invitationDataRaw.expires_at) < new Date()) {
        setError('This invitation has expired.');
        return;
      }

      const invitationData: InvitationData = {
        id: invitationDataRaw.id,
        organization_id: invitationDataRaw.organization_id,
        email: invitationDataRaw.email,
        role: invitationDataRaw.role,
        organization_name: invitationDataRaw.organization_name,
        inviter_name: invitationDataRaw.inviter_name,
        expires_at: invitationDataRaw.expires_at,
        accepted_at: invitationDataRaw.accepted_at
      };

      setInvitation(invitationData);
      setEmail(invitationData.email);

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
      setError('Failed to load invitation details.');
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
        const { error } = await signUp(email, password, fullName, invitation.organization_name);
        
        if (error) {
          setError(error.message);
          return;
        }

        toast({
          title: "Account created",
          description: "Please check your email to verify your account, then return to accept the invitation.",
        });
      } else {
        const { error } = await signIn(email, password);
        
        if (error) {
          setError(error.message);
          return;
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError('Authentication failed. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const acceptInvitation = async () => {
    if (!invitation || !user) return;

    try {
      setAccepting(true);
      setError(null);

      console.log('Accepting invitation:', invitation.id);
      
      // Accept the invitation
      const { error: inviteError } = await supabase
        .from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id);

      if (inviteError) {
        console.error('Error updating invitation:', inviteError);
        throw inviteError;
      }

      console.log('Adding user to organization:', invitation.organization_id);
      
      // Add user to organization
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: invitation.organization_id,
          user_id: user.id,
          role: invitation.role
        });

      if (memberError) {
        console.error('Error adding member:', memberError);
        throw memberError;
      }

      toast({
        title: "Invitation accepted!",
        description: `Welcome to ${invitation.organization_name}!`,
      });

      // Redirect to dashboard
      navigate('/dashboard');

    } catch (error) {
      console.error('Error accepting invitation:', error);
      setError('Failed to accept invitation. Please try again.');
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
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
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
              <input
                id="password"
                type="password"
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
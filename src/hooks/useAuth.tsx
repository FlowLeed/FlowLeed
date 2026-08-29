import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { identifyUser, resetUser } from '@/lib/analytics';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string, organizationName?: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
  changeEmail: (newEmail: string) => Promise<{ error: any }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let initialSessionLoaded = false;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[useAuth] Auth state changed:', event);

        // Ignore the synthetic INITIAL_SESSION event — getSession() below is the source of truth
        // for the initial load. Without this guard, an INITIAL_SESSION event with session=null
        // can fire before storage is restored, causing ProtectedRoute to redirect to /auth.
        if (event === 'INITIAL_SESSION' && !initialSessionLoaded) {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          identifyUser(session.user.id, {
            email: session.user.email,
          });
        }

        // Track login when user signs in
        if (event === 'SIGNED_IN' && session?.user) {
          // Check if this is an impersonation session (skip tracking for impersonation)
          const isImpersonation = sessionStorage.getItem('impersonation_session');
          const lastTrackedLogin = sessionStorage.getItem('last_tracked_login');
          
          // Only track if not impersonating AND we haven't tracked in this session
          if (!isImpersonation && !lastTrackedLogin) {
            sessionStorage.setItem('last_tracked_login', Date.now().toString());
            
            setTimeout(() => {
              supabase.functions.invoke('track-login', {
                headers: {
                  Authorization: `Bearer ${session.access_token}`
                }
              }).then(({ data }) => {
                console.log('Track login response:', data);
                // If default flows were just created, notify the UI to refresh
                if (data?.createdDefaults) {
                  console.log('🎉 Default flows were created, dispatching refresh event');
                  window.dispatchEvent(new CustomEvent('flows-created', { detail: data }));
                }
              }).catch(err => {
                console.error('Failed to track login:', err);
              });
            }, 0);
          } else {
            console.log('[useAuth] Login already tracked in this session');
          }
        }
      }
    );

    // Get initial session (source of truth for initial load — restores from storage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[useAuth] Getting initial session, hasSession:', !!session);
      initialSessionLoaded = true;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error };
    return { error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName?: string,
    organizationName?: string,
  ) => {
    const metadata: Record<string, string> = {};
    if (fullName) metadata.full_name = fullName;
    if (organizationName) metadata.organization_name = organizationName;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: metadata,
      },
    });

    if (error) {
      return { error };
    }

    return { error: null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error };
  };


  const signOut = async () => {
    sessionStorage.removeItem('last_tracked_login');
    resetUser();
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    // Send custom password reset email via edge function
    try {
      console.log('Sending password reset email to:', email);
      const { data: emailData, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email },
      });
      
      if (!error) {
        console.log('Password reset email sent successfully:', emailData);
      }
      
      return { error };
    } catch (err: any) {
      console.error('Failed to send password reset email:', err);
      return { error: err };
    }
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password: password
    });
    return { error };
  };

  const changeEmail = async (newEmail: string) => {
    const { error } = await supabase.auth.updateUser({
      email: newEmail
    });
    return { error };
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    // First verify current password by attempting sign in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return { error: { message: 'No user found' } };
    }
    
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });
    
    if (verifyError) {
      return { error: { message: 'Current password is incorrect' } };
    }
    
    // Now update to new password
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    changeEmail,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
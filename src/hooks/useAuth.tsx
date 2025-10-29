import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, organizationName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
  isImpersonating: boolean;
  impersonatedUserId: string | null;
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
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[useAuth] Auth state changed:', event);
        
        // Check for impersonation session
        const impersonationData = sessionStorage.getItem('impersonation_session');
        
        if (impersonationData && session?.user) {
          try {
            const impSession = JSON.parse(impersonationData);
            console.log('[useAuth] Loading impersonation session:', impSession.targetOrgName);
            
            // Override with target user context
            setIsImpersonating(true);
            setImpersonatedUserId(impSession.targetUserId);
            
            // Create a synthetic user object for the target user with timeout
            const profilePromise = supabase
              .from('profiles')
              .select('*')
              .eq('user_id', impSession.targetUserId)
              .single();
            
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Profile load timeout')), 5000)
            );
            
            try {
              const { data: targetProfile } = await Promise.race([
                profilePromise,
                timeoutPromise
              ]) as any;
              
              if (targetProfile) {
                // Override user with target user data but keep the session
                const syntheticUser = {
                  ...session.user,
                  id: impSession.targetUserId,
                  email: targetProfile.email,
                };
                setUser(syntheticUser as User);
                setSession(session);
                console.log('[useAuth] Impersonation loaded successfully');
              } else {
                throw new Error('Target profile not found');
              }
            } catch (profileError) {
              console.error('[useAuth] Failed to load target profile:', profileError);
              // Fallback: use admin user but keep impersonation flag
              setUser(session?.user ?? null);
              setSession(session);
            }
          } catch (error) {
            console.error('[useAuth] Error loading impersonation session:', error);
            sessionStorage.removeItem('impersonation_session');
            setIsImpersonating(false);
            setUser(session?.user ?? null);
          }
        } else {
          setIsImpersonating(false);
          setImpersonatedUserId(null);
          setSession(session);
          setUser(session?.user ?? null);
        }
        
        setLoading(false);
        
        // Track login when user signs in (skip for impersonation)
        if (event === 'SIGNED_IN' && session?.user && !impersonationData) {
          setTimeout(() => {
            supabase.functions.invoke('track-login', {
              headers: {
                Authorization: `Bearer ${session.access_token}`
              }
            }).catch(err => {
              console.error('Failed to track login:', err);
            });
          }, 0);
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[useAuth] Getting initial session');
      
      // Check for impersonation on mount
      const impersonationData = sessionStorage.getItem('impersonation_session');
      
      if (impersonationData && session?.user) {
        try {
          const impSession = JSON.parse(impersonationData);
          console.log('[useAuth] Initial impersonation load:', impSession.targetOrgName);
          
          setIsImpersonating(true);
          setImpersonatedUserId(impSession.targetUserId);
          
          const profilePromise = supabase
            .from('profiles')
            .select('*')
            .eq('user_id', impSession.targetUserId)
            .single();
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Initial profile load timeout')), 5000)
          );
          
          try {
            const { data: targetProfile } = await Promise.race([
              profilePromise,
              timeoutPromise
            ]) as any;
            
            if (targetProfile) {
              const syntheticUser = {
                ...session.user,
                id: impSession.targetUserId,
                email: targetProfile.email,
              };
              setUser(syntheticUser as User);
              setSession(session);
              console.log('[useAuth] Initial impersonation loaded successfully');
            } else {
              throw new Error('Target profile not found');
            }
          } catch (profileError) {
            console.error('[useAuth] Failed to load initial target profile:', profileError);
            // Fallback: use admin user but keep impersonation flag
            setUser(session?.user ?? null);
            setSession(session);
          }
        } catch (error) {
          console.error('[useAuth] Error loading initial impersonation session:', error);
          sessionStorage.removeItem('impersonation_session');
          setIsImpersonating(false);
          setUser(session?.user ?? null);
        }
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, organizationName: string) => {
    // Create user without auto-confirming email
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          organization_name: organizationName,
        },
      },
    });

    if (error) {
      return { error };
    }

    // Send custom verification email via edge function
    if (data.user) {
      try {
        console.log('Sending signup confirmation email to:', email);
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-signup-confirmation', {
          body: {
            email,
            userId: data.user.id,
            fullName,
            organizationName,
          },
        });

        if (emailError) {
          console.error('Error sending verification email:', emailError);
        } else {
          console.log('Confirmation email sent successfully:', emailData);
        }
      } catch (err) {
        console.error('Failed to send verification email:', err);
      }
    }

    return { error: null };
  };

  const signOut = async () => {
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

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    isImpersonating,
    impersonatedUserId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
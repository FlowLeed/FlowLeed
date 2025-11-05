import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return new Response(
        JSON.stringify({ error: 'Token and password are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters long' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Processing password reset with token verification');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const tokenSalt = Deno.env.get('TOKEN_SALT')!;

    if (!tokenSalt) {
      console.error('TOKEN_SALT environment variable is not set');
      throw new Error('Server configuration error');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hash the token to look it up in the database
    const encoder = new TextEncoder();
    const data = encoder.encode(token + tokenSalt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log('Looking up token in database');

    // Verify token exists, is not used, not expired, and is for password reset
    const { data: tokenData, error: tokenError } = await supabase
      .from('auth_verification_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('token_type', 'password_reset')
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !tokenData) {
      console.error('Invalid or expired token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired reset token' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Token verified, updating password for email:', tokenData.email);

    // Get user by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const user = users?.find(u => u.email === tokenData.email);

    if (!user) {
      console.error('User not found for email:', tokenData.email);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Update user password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw updateError;
    }

    // Mark token as used
    const { error: markUsedError } = await supabase
      .from('auth_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.id);

    if (markUsedError) {
      console.error('Error marking token as used:', markUsedError);
      // Don't fail the request, password was already updated
    }

    console.log('Password updated successfully for user:', user.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Password has been reset successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

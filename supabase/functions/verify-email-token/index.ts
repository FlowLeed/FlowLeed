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
    const { token, type } = await req.json();

    console.log('Verifying token:', { type });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const tokenSalt = Deno.env.get('TOKEN_SALT')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hash the token
    const encoder = new TextEncoder();
    const data = encoder.encode(token + tokenSalt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Find the token in database
    const { data: tokenData, error: tokenError } = await supabase
      .from('auth_verification_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('token_type', type)
      .is('used_at', null)
      .single();

    if (tokenError || !tokenData) {
      console.error('Token not found or already used:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      console.error('Token expired');
      return new Response(
        JSON.stringify({ error: 'Token has expired' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Mark token as used
    const { error: updateError } = await supabase
      .from('auth_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.id);

    if (updateError) {
      console.error('Error updating token:', updateError);
      throw updateError;
    }

    // If this is a signup verification, confirm the user's email
    if (type === 'signup' && tokenData.user_id) {
      const { error: confirmError } = await supabase.auth.admin.updateUserById(
        tokenData.user_id,
        { email_confirm: true }
      );

      if (confirmError) {
        console.error('Error confirming email:', confirmError);
        throw confirmError;
      }
    }

    console.log('Token verified successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: tokenData.user_id,
        email: tokenData.email,
        type: tokenData.token_type
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

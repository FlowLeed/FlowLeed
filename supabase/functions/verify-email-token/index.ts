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

    // Determine which table to use based on verification type
    const tableName = (type === 'signup' || type === 'password_reset') ? 'auth_verification_tokens' : 'email_verification_tokens';
    
    // Find the token in database
    const query = supabase
      .from(tableName)
      .select('*')
      .eq('token_hash', tokenHash)
      .is('used_at', null);
    
    // For signup or password_reset, also filter by token_type
    if (type === 'signup' || type === 'password_reset') {
      query.eq('token_type', type);
    }
    
    const { data: tokenData, error: tokenError } = await query.single();

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
      .from(tableName)
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

    // If this is an email change verification, update the user's email
    if (type === 'email_change' && tokenData.user_id && tokenData.new_email) {
      console.log('Updating user email...');
      
      const { error: emailUpdateError } = await supabase.auth.admin.updateUserById(
        tokenData.user_id,
        { email: tokenData.new_email, email_confirm: true }
      );

      if (emailUpdateError) {
        console.error('Error updating email:', emailUpdateError);
        throw emailUpdateError;
      }

      console.log(`Email updated successfully to ${tokenData.new_email}`);
    }

    // If this is a password reset verification, return the email for the frontend
    if (type === 'password_reset') {
      console.log('Password reset token verified for email:', tokenData.email);
      return new Response(
        JSON.stringify({ 
          success: true, 
          email: tokenData.email,
          type: type
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Token verified successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: tokenData.user_id,
        email: tokenData.new_email || tokenData.metadata?.current_email,
        type: type
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

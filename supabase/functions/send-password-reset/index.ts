import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4.0.0';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import React from 'npm:react@18.3.1';
import { PasswordResetEmail } from './_templates/password-reset.tsx';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    console.log('Sending password reset to:', email);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const tokenSalt = Deno.env.get('TOKEN_SALT')!;
    const siteUrl = Deno.env.get('SITE_URL') || 'https://flowleed.com';
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Note: We don't check if user exists for security (prevents user enumeration)
    // Token will be created regardless, but only valid users can use it
    console.log('Processing password reset request for:', email);

    // Generate token
    const rawToken = crypto.randomUUID();
    const encoder = new TextEncoder();
    const data = encoder.encode(rawToken + tokenSalt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Store token in database
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
    const { error: dbError } = await supabase
      .from('auth_verification_tokens')
      .insert({
        email: email,
        token_hash: tokenHash,
        token_type: 'password_reset',
        expires_at: expiresAt.toISOString(),
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    // Create reset link
    const resetUrl = `${siteUrl}/auth/verify?token=${rawToken}&type=password_reset`;

    // Render email template
    const html = await renderAsync(
      React.createElement(PasswordResetEmail, {
        resetUrl,
        email,
      })
    );

    // Send email
    const { error: emailError } = await resend.emails.send({
      from: 'Flowleed <noreply@flowleed.com>',
      to: [email],
      subject: 'Reset your password - Flowleed',
      html,
    });

    if (emailError) {
      console.error('Email error:', emailError);
      throw emailError;
    }

    console.log('Password reset sent successfully');

    return new Response(
      JSON.stringify({ success: true }),
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

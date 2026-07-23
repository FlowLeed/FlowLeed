import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4.0.0';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import React from 'npm:react@18.3.1';
import { SignupConfirmationEmail } from './_templates/signup-confirmation.tsx';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, userId: userIdIn, fullName, organizationName, resend: isResend } = await req.json();

    console.log('Sending signup confirmation to:', email, 'resend:', !!isResend);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const tokenSalt = Deno.env.get('TOKEN_SALT')!;
    const siteUrl = Deno.env.get('SITE_URL') || 'https://flowleed.com';
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resendClient = new Resend(resendApiKey);

    // On resend flow, look up the user by email so we can attach a user_id.
    let userId: string | null = userIdIn ?? null;
    let resolvedFullName = fullName as string | undefined;
    if (!userId && email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, full_name, email_verified_at')
        .eq('email', email)
        .maybeSingle();
      if (profile) {
        // Silently succeed if already verified — don't leak account existence.
        if (profile.email_verified_at) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        userId = profile.user_id;
        resolvedFullName = resolvedFullName || profile.full_name || undefined;
      } else {
        // Don't reveal that the account doesn't exist.
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Generate token (raw token for user, hashed for storage)
    const rawToken = crypto.randomUUID();
    const encoder = new TextEncoder();
    const data = encoder.encode(rawToken + tokenSalt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Store token in database
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    const { error: dbError } = await supabase
      .from('auth_verification_tokens')
      .insert({
        user_id: userId,
        email: email,
        token_hash: tokenHash,
        token_type: 'signup',
        expires_at: expiresAt.toISOString(),
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    // Create verification link
    const verificationUrl = `${siteUrl}/auth/verify?token=${rawToken}&type=signup`;

    // Render email template
    const html = await renderAsync(
      React.createElement(SignupConfirmationEmail, {
        fullName: fullName || email.split('@')[0],
        organizationName: organizationName || 'your organization',
        verificationUrl,
        email,
      })
    );

    // Send email
    const { error: emailError } = await resend.emails.send({
      from: 'Flowleed <noreply@flowleed.com>',
      to: [email],
      subject: 'Verify your email - Flowleed',
      html,
    });

    if (emailError) {
      console.error('Email error:', emailError);
      throw emailError;
    }

    console.log('Signup confirmation sent successfully');

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

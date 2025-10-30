import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";
import React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { EmailChangeEmail } from "./_templates/email-change.tsx";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { newEmail } = await req.json();

    if (!newEmail) {
      throw new Error('New email is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
    const siteUrl = Deno.env.get('SITE_URL') || supabaseUrl;
    const tokenSalt = Deno.env.get('TOKEN_SALT') || 'default-salt-change-in-production';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get the authenticated user from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log(`Processing email change for user: ${user.id} from ${user.email} to ${newEmail}`);

    // Check if the new email is already in use
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const emailInUse = existingUser?.users?.some(u => u.email === newEmail && u.id !== user.id);
    
    if (emailInUse) {
      throw new Error('This email address is already in use');
    }

    // Generate a secure token
    const rawToken = crypto.randomUUID();
    const encoder = new TextEncoder();
    const data = encoder.encode(rawToken + tokenSalt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Store the token in the database
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration

    const { error: insertError } = await supabase
      .from('email_verification_tokens')
      .insert({
        user_id: user.id,
        token: rawToken,
        token_hash: tokenHash,
        new_email: newEmail,
        expires_at: expiresAt.toISOString(),
        metadata: {
          current_email: user.email,
        },
      });

    if (insertError) {
      console.error('Error inserting token:', insertError);
      throw new Error('Failed to create verification token');
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();

    // Create verification URL
    const verifyUrl = `${siteUrl}/verify-email?token=${rawToken}&type=email_change`;

    // Render the email template
    const html = await renderAsync(
      React.createElement(EmailChangeEmail, {
        verifyUrl,
        currentEmail: user.email || '',
        newEmail,
        userName: profile?.full_name,
      })
    );

    // Send the email
    const { error: emailError } = await resend.emails.send({
      from: 'Flowleed <onboarding@resend.dev>',
      to: [newEmail],
      subject: 'Verify your new email address',
      html,
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
      throw new Error('Failed to send verification email');
    }

    console.log('Email change verification sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Verification email sent to your new email address' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in change-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

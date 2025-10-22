import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

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
    const { token, email, password, fullName } = await req.json();

    if (!token || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Validating invitation token...');

    // Validate invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('email', email)
      .is('accepted_at', null)
      .single();

    if (inviteError || !invitation) {
      console.error('Invalid invitation:', inviteError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired invitation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      console.error('Invitation expired');
      return new Response(
        JSON.stringify({ error: 'Invitation has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating user with email:', email);

    // Create user with email already confirmed
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email confirmation
      user_metadata: {
        full_name: fullName || email.split('@')[0],
        skip_org_creation: true, // Signal to not create org for invited users
        invited_to_org: invitation.organization_id // Reference to the org they're joining
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created:', userData.user.id);

    // Add user to organization
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: invitation.organization_id,
        user_id: userData.user.id,
        role: invitation.role
      });

    if (memberError) {
      console.error('Error adding to organization:', memberError);
      // Don't fail here - user was created, we can manually add them later
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabaseAdmin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      // Don't fail here - user was created and added to org
    }

    console.log('Invitation accepted successfully');

    // Create a session for the user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      // User exists, they can sign in manually
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Account created successfully. Please sign in.',
          requiresSignIn: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: userData.user,
        session: sessionData
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-invited-user:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

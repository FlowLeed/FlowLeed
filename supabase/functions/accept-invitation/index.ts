import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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
    const { token } = await req.json();

    if (!token) {
      console.error('No token provided');
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing invitation acceptance for token:', token);

    // Get the authenticated user using anon client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      console.error('Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.email);

    // Use service role client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Look up the invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .select('*, organizations(name)')
      .eq('token', token)
      .single();

    if (inviteError || !invitation) {
      console.error('Invitation not found:', inviteError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired invitation' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found invitation for:', invitation.email);

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      console.error('Invitation expired');
      return new Response(
        JSON.stringify({ error: 'This invitation has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invitation already accepted
    if (invitation.accepted_at) {
      console.log('Invitation already accepted, checking if user is already a member');
      
      // Check if user is already a member (idempotent behavior)
      const { data: existingMember } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', invitation.organization_id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        console.log('User is already a member, returning success (idempotent)');
        return new Response(
          JSON.stringify({ 
            success: true,
            message: `You're already a member of ${invitation.organizations?.name}`,
            organization_name: invitation.organizations?.name,
            already_member: true
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Verify email matches (case-insensitive)
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      console.error('Email mismatch:', user.email, 'vs', invitation.email);
      return new Response(
        JSON.stringify({ 
          error: `This invitation is for ${invitation.email}. Please sign out and sign in with the correct email address.`
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Email verified, adding user to organization');

    // Add user to organization (upsert to handle idempotency)
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .upsert({
        organization_id: invitation.organization_id,
        user_id: user.id,
        role: invitation.role,
      }, {
        onConflict: 'organization_id,user_id',
        ignoreDuplicates: false
      });

    if (memberError) {
      console.error('Error adding member:', memberError);
      return new Response(
        JSON.stringify({ error: 'Failed to add you to the organization' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User added to organization, marking invitation as accepted');

    // Mark invitation as accepted
    const { error: updateError } = await supabaseAdmin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      // Not a critical error - user is already added to org
    }

    console.log('Invitation accepted successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Welcome to ${invitation.organizations?.name}!`,
        organization_name: invitation.organizations?.name
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

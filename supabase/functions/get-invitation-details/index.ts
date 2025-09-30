import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token parameter is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Looking up invitation with token:', token);

    // Fetch invitation details with organization and profile information
    const { data: invitation, error } = await supabase
      .from('invitations')
      .select(`
        id,
        email,
        role,
        expires_at,
        accepted_at,
        organization_id,
        organizations!inner (
          id,
          name
        ),
        profiles!invitations_invited_by_user_id_fkey (
          full_name
        )
      `)
      .eq('token', token)
      .single();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Invitation not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!invitation) {
      return new Response(
        JSON.stringify({ error: 'Invitation not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Return only the necessary invitation details
    const invitationDetails = {
      email: invitation.email,
      role: invitation.role,
      expires_at: invitation.expires_at,
      accepted_at: invitation.accepted_at,
      organization_name: (invitation.organizations as any)?.name || 'Unknown Organization',
      inviter_name: (invitation.profiles as any)?.full_name || 'Someone'
    };

    console.log('Returning invitation details:', invitationDetails);

    return new Response(
      JSON.stringify(invitationDetails),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-invitation-details function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
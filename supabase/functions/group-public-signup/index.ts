import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    // GET request - fetch group details by token
    if (req.method === 'GET') {
      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Token is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Fetching group for token:', token);

      // Fetch group by public_signup_token
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select(`
          id,
          name,
          description,
          group_type,
          meeting_day,
          meeting_time,
          meeting_frequency,
          location,
          capacity,
          image_url,
          visibility,
          allow_public_signup,
          member_count:group_members(count)
        `)
        .eq('public_signup_token', token)
        .single();

      if (groupError || !group || group.visibility !== 'public') {
        console.error('Group not found or not listed:', groupError);
        return new Response(
          JSON.stringify({ error: 'Group not found or not listed' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const memberCount = group.member_count?.[0]?.count || 0;
      const isFull = group.capacity ? memberCount >= group.capacity : false;

      return new Response(
        JSON.stringify({
          group: {
            id: group.id,
            name: group.name,
            description: group.description,
            group_type: group.group_type,
            meeting_day: group.meeting_day,
            meeting_time: group.meeting_time,
            meeting_frequency: group.meeting_frequency,
            location: group.location,
            capacity: group.capacity,
            image_url: group.image_url,
            allow_public_signup: group.allow_public_signup,
            member_count: memberCount,
            is_full: isFull,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST request - submit signup
    if (req.method === 'POST') {
      const body = await req.json();
      const { token: signupToken, name, email, phone } = body;

      if (!signupToken || !name || !email) {
        return new Response(
          JSON.stringify({ error: 'Token, name, and email are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Processing signup for token:', signupToken, 'email:', email);

      // Fetch group by token
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select(`
          id,
          organization_id,
          capacity,
          allow_public_signup,
          member_count:group_members(count)
        `)
        .eq('public_signup_token', signupToken)
        .eq('allow_public_signup', true)
        .single();

      if (groupError || !group) {
        console.error('Group not found:', groupError);
        return new Response(
          JSON.stringify({ error: 'Group not found or signup is not enabled' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check capacity
      const memberCount = group.member_count?.[0]?.count || 0;
      if (group.capacity && memberCount >= group.capacity) {
        return new Response(
          JSON.stringify({ error: 'This group is full' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if already signed up
      const { data: existingRequest } = await supabase
        .from('group_signup_requests')
        .select('id, status')
        .eq('group_id', group.id)
        .eq('email', email.toLowerCase())
        .single();

      if (existingRequest) {
        return new Response(
          JSON.stringify({ 
            error: existingRequest.status === 'approved' 
              ? 'You are already a member of this group' 
              : 'You have already submitted a signup request for this group'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if contact exists in org
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('organization_id', group.organization_id)
        .ilike('email', email)
        .single();

      // Check if already a member
      if (existingContact) {
        const { data: existingMember } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', group.id)
          .eq('contact_id', existingContact.id)
          .single();

        if (existingMember) {
          return new Response(
            JSON.stringify({ error: 'You are already a member of this group' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Create signup request
      const { data: signupRequest, error: signupError } = await supabase
        .from('group_signup_requests')
        .insert({
          group_id: group.id,
          name,
          email: email.toLowerCase(),
          phone: phone || null,
          contact_id: existingContact?.id || null,
          status: 'pending',
        })
        .select()
        .single();

      if (signupError) {
        console.error('Error creating signup request:', signupError);
        return new Response(
          JSON.stringify({ error: 'Failed to submit signup request' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Signup request created:', signupRequest.id);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Your signup request has been submitted. A group leader will review it shortly.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in group-public-signup:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

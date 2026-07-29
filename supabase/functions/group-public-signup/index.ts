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
          name,
          organization_id,
          capacity,
          allow_public_signup,
          meeting_day,
          meeting_time,
          meeting_frequency,
          location,
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

      // --- Communication: confirmation + leader notification emails ---
      try {
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (resendApiKey) {
          const [{ data: settings }, { data: org }] = await Promise.all([
            supabase.from('group_settings').select('*').eq('organization_id', group.organization_id).maybeSingle(),
            supabase.from('organizations').select('name').eq('id', group.organization_id).maybeSingle(),
          ]);

          const meetingBits = [
            group.meeting_day,
            group.meeting_time,
            group.meeting_frequency,
            group.location,
          ].filter(Boolean);

          const vars: Record<string, string> = {
            name,
            email: email.toLowerCase(),
            phone: phone || '—',
            group_name: group.name || 'the group',
            org_name: org?.name || 'Our church',
            meeting_details: meetingBits.length ? `When: ${meetingBits.join(' · ')}` : '',
          };

          const render = (tpl: string) =>
            tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? '');

          const toHtml = (text: string) =>
            `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;white-space:pre-wrap">${
              text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            }</div>`;

          const replyTo = settings?.communication_reply_to || undefined;

          const send = async (to: string[], subject: string, body: string) => {
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: `${vars.org_name} Groups <noreply@flowleed.com>`,
                to,
                subject: render(subject),
                html: toHtml(render(body)),
                ...(replyTo ? { reply_to: replyTo } : {}),
              }),
            });
            if (!res.ok) console.error('Resend error:', res.status, await res.text());
          };

          const DEFAULT_CONFIRM_SUBJECT = 'We got your signup for {{group_name}}';
          const DEFAULT_CONFIRM_BODY =
            'Hi {{name}},\n\nThanks for signing up for {{group_name}}! A group leader will review your request and reach out with next steps.\n\n{{meeting_details}}\n\nSee you soon,\n{{org_name}}';
          const DEFAULT_LEADER_SUBJECT = 'New signup request for {{group_name}}';
          const DEFAULT_LEADER_BODY =
            '{{name}} just requested to join {{group_name}}.\n\nEmail: {{email}}\nPhone: {{phone}}\n\nLog in to {{org_name}} to approve or decline this request.';

          if (settings?.signup_confirmation_enabled !== false) {
            await send(
              [email.toLowerCase()],
              settings?.signup_confirmation_subject || DEFAULT_CONFIRM_SUBJECT,
              settings?.signup_confirmation_body || DEFAULT_CONFIRM_BODY,
            );
          }

          if (settings?.leader_notification_enabled !== false) {
            const { data: leaders } = await supabase
              .from('group_members')
              .select('role, contact:contacts(email)')
              .eq('group_id', group.id)
              .in('role', ['leader', 'co_leader']);

            const leaderEmails = Array.from(
              new Set(
                (leaders || [])
                  .map((l: any) => l.contact?.email)
                  .filter((e: string | null) => !!e)
                  .map((e: string) => e.toLowerCase()),
              ),
            );

            if (leaderEmails.length) {
              await send(
                leaderEmails,
                settings?.leader_notification_subject || DEFAULT_LEADER_SUBJECT,
                settings?.leader_notification_body || DEFAULT_LEADER_BODY,
              );
            } else {
              console.log('No leader emails found for group', group.id);
            }
          }
        } else {
          console.log('RESEND_API_KEY not set — skipping signup emails');
        }
      } catch (emailErr) {
        console.error('Signup email error (non-fatal):', emailErr);
      }



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

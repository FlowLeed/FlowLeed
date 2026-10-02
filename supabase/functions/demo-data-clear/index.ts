// Deletes every record flagged as sample data for the caller's organization.
// Called by "Set Up My Church" and automatically the first time real data arrives.
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: membership } = await admin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership?.organization_id) return json({ error: 'No organization' }, 403);
    const orgId = membership.organization_id as string;

    // Contacts / flows / groups cascade to their children via FK constraints.
    const { data: demoContacts } = await admin
      .from('contacts')
      .select('id')
      .eq('organization_id', orgId)
      .eq('is_demo', true);
    const contactIds = (demoContacts ?? []).map((c) => c.id as string);

    if (contactIds.length) {
      // Suggestions have no cascade guarantee — clear them explicitly first.
      await admin.from('signal_agent_suggestions').delete().in('contact_id', contactIds);
      await admin.from('flow_moments').delete().in('contact_id', contactIds);
      await admin.from('contact_interactions').delete().in('contact_id', contactIds);
      await admin.from('contact_notes').delete().in('contact_id', contactIds);
      await admin.from('contact_engagement_scores').delete().in('contact_id', contactIds);
      await admin.from('pipeline_contacts').delete().in('contact_id', contactIds);
      await admin.from('group_members').delete().in('contact_id', contactIds);
    }

    const { data: demoGroups } = await admin
      .from('groups')
      .select('id')
      .eq('organization_id', orgId)
      .eq('is_demo', true);
    const groupIds = (demoGroups ?? []).map((g) => g.id as string);
    if (groupIds.length) {
      const { data: meetings } = await admin
        .from('group_meetings')
        .select('id')
        .in('group_id', groupIds);
      const meetingIds = (meetings ?? []).map((m) => m.id as string);
      if (meetingIds.length) {
        await admin.from('group_attendance').delete().in('group_meeting_id', meetingIds);
        await admin.from('group_meetings').delete().in('id', meetingIds);
      }
      await admin.from('group_members').delete().in('group_id', groupIds);
      await admin.from('groups').delete().in('id', groupIds);
    }

    const { data: demoFlows } = await admin
      .from('pipelines')
      .select('id')
      .eq('organization_id', orgId)
      .eq('is_demo', true);
    const flowIds = (demoFlows ?? []).map((p) => p.id as string);
    if (flowIds.length) {
      await admin.from('pipeline_contacts').delete().in('pipeline_id', flowIds);
      await admin.from('pipeline_team_members').delete().in('pipeline_id', flowIds);
      await admin.from('pipeline_stages').delete().in('pipeline_id', flowIds);
      await admin.from('pipelines').delete().in('id', flowIds);
    }

    if (contactIds.length) {
      await admin.from('contacts').delete().in('id', contactIds);
    }

    await admin
      .from('organizations')
      .update({ demo_cleared_at: new Date().toISOString(), demo_seeded_at: null })
      .eq('id', orgId);

    return json({
      ok: true,
      deleted: { contacts: contactIds.length, flows: flowIds.length, groups: groupIds.length },
    });
  } catch (e) {
    console.error('[demo-data-clear]', e);
    return json({ error: (e as Error).message }, 500);
  }
});

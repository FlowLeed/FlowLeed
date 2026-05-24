// Syncs Planning Center Group events + attendances into FlowLeed.
// Pulls last 90 days of events per group (capped per run).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const API_DELAY = 350;
const MAX_GROUPS_PER_RUN = 25;
const LOOKBACK_DAYS = 90;

async function pcoFetch(url: string, auth: string, retries = 3): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('Retry-After') || '5', 10) * 1000;
      await sleep(Math.max(wait, 1000 * Math.pow(2, i)));
      continue;
    }
    return res;
  }
  throw new Error('PCO fetch failed');
}

async function fetchAllPages(url: string, auth: string, maxPages = 20) {
  const all: any[] = [];
  let next: string | null = url;
  let p = 0;
  while (next && p < maxPages) {
    p++;
    const r = await pcoFetch(next, auth);
    if (!r.ok) {
      if (r.status === 401) throw new Error('PCO_AUTH_FAILED');
      throw new Error(`PCO ${r.status}`);
    }
    const j = await r.json();
    all.push({ data: j.data || [], included: j.included || [] });
    next = j.links?.next || null;
    if (next) await sleep(API_DELAY);
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    if (!req.headers.get('Authorization'))
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    const { integrationId } = await req.json();
    if (!integrationId)
      return new Response(JSON.stringify({ error: 'integrationId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials, organization_id, metadata')
      .eq('id', integrationId).single();
    if (!integration)
      return new Response(JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const creds = integration.credentials as any;
    if (!creds?.application_id || !creds?.secret)
      return new Response(JSON.stringify({ error: 'Missing PCO credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const auth = btoa(`${creds.application_id}:${creds.secret}`);
    const orgId = integration.organization_id;
    const metadata = (integration.metadata as any) || {};

    // Get all org groups that have a PCO id
    const { data: groups } = await supabase
      .from('groups').select('id, pco_group_id, name')
      .eq('organization_id', orgId)
      .not('pco_group_id', 'is', null)
      .is('archived_at', null)
      .order('id');
    const all = groups || [];

    const cursorIdx = metadata.groups_attendance_cursor_idx || 0;
    const slice = all.slice(cursorIdx, cursorIdx + MAX_GROUPS_PER_RUN);
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();

    let meetingsUpserted = 0, attendancesUpserted = 0;

    for (const g of slice) {
      try {
        // Events for this group in lookback window
        const evtPages = await fetchAllPages(
          `https://api.planningcenteronline.com/groups/v2/groups/${g.pco_group_id}/events` +
          `?per_page=100&where[starts_at][gte]=${encodeURIComponent(since)}&order=starts_at`,
          auth, 5
        );
        const meetingRows: any[] = [];
        const eventIds: { pco: string; localPromise?: any }[] = [];
        for (const page of evtPages) {
          for (const e of page.data) {
            const a = e.attributes || {};
            meetingRows.push({
              group_id: g.id,
              pco_event_id: e.id,
              title: a.name || g.name || 'Group Meeting',
              description: a.description || null,
              meeting_date: a.starts_at,
              duration_minutes: a.ends_at && a.starts_at
                ? Math.round((+new Date(a.ends_at) - +new Date(a.starts_at)) / 60000)
                : 90,
              location: a.location_type_preference || null,
              status: a.canceled ? 'cancelled' : (new Date(a.starts_at) > new Date() ? 'scheduled' : 'completed'),
              attendance_submitted: !!a.attendance_submitted_at,
            });
            eventIds.push({ pco: e.id });
          }
        }

        if (meetingRows.length) {
          const { error } = await supabase
            .from('group_meetings')
            .upsert(meetingRows, { onConflict: 'pco_event_id' });
          if (error) console.error(`meetings upsert (${g.pco_group_id}):`, error.message);
          else meetingsUpserted += meetingRows.length;
        }

        // Re-fetch local meeting ids by pco_event_id
        const pcoEvtIds = meetingRows.map(m => m.pco_event_id);
        if (!pcoEvtIds.length) continue;
        const { data: localMeetings } = await supabase
          .from('group_meetings').select('id, pco_event_id, meeting_date')
          .in('pco_event_id', pcoEvtIds);
        const mIdMap = new Map((localMeetings || []).map(m => [m.pco_event_id!, { id: m.id, date: m.meeting_date }]));

        // Get group_members for this group for matching
        const { data: gms } = await supabase
          .from('group_members').select('id, contact_id, pco_person_id')
          .eq('group_id', g.id);
        const memberByPerson = new Map((gms || []).filter(m => m.pco_person_id).map(m => [m.pco_person_id!, m]));

        // Fetch attendances per event (only submitted ones for efficiency)
        for (const m of meetingRows.filter(m => m.attendance_submitted)) {
          const local = mIdMap.get(m.pco_event_id);
          if (!local) continue;
          try {
            const attPages = await fetchAllPages(
              `https://api.planningcenteronline.com/groups/v2/events/${m.pco_event_id}/attendances?per_page=100&include=person`,
              auth, 5
            );
            const attRows: any[] = [];
            for (const ap of attPages) {
              for (const a of ap.data) {
                const personId = a.relationships?.person?.data?.id;
                if (!personId) continue;
                const member = memberByPerson.get(personId);
                attRows.push({
                  group_meeting_id: local.id,
                  group_member_id: member?.id || null,
                  contact_id: member?.contact_id || null,
                  pco_attendance_id: a.id,
                  pc_person_id: personId,
                  status: a.attributes?.attended ? 'present' : 'absent',
                  checked_in_at: a.attributes?.attended ? local.date : null,
                });
              }
            }
            if (attRows.length) {
              for (let i = 0; i < attRows.length; i += 100) {
                const { error } = await supabase
                  .from('group_attendance')
                  .upsert(attRows.slice(i, i + 100), { onConflict: 'pco_attendance_id' });
                if (error) console.error('attendance upsert:', error.message);
                else attendancesUpserted += Math.min(100, attRows.length - i);
              }
            }
          } catch (e) {
            console.error(`attendance fetch (event ${m.pco_event_id}):`, (e as Error).message);
            if ((e as Error).message === 'PCO_AUTH_FAILED') throw e;
          }
        }

        // Bump last_meeting_at
        const lastDate = meetingRows
          .filter(m => new Date(m.meeting_date) <= new Date())
          .map(m => m.meeting_date).sort().pop();
        if (lastDate) {
          await supabase.from('groups').update({ last_meeting_at: lastDate }).eq('id', g.id);
        }
      } catch (e) {
        console.error(`group ${g.pco_group_id} events error:`, (e as Error).message);
        if ((e as Error).message === 'PCO_AUTH_FAILED') throw e;
      }
    }

    const nextIdx = cursorIdx + MAX_GROUPS_PER_RUN;
    const hasMore = nextIdx < all.length;
    if (hasMore) {
      await supabase.from('integrations').update({
        metadata: { ...metadata, groups_attendance_cursor_idx: nextIdx }
      }).eq('id', integrationId);
    } else {
      const { groups_attendance_cursor_idx, ...rest } = metadata;
      await supabase.from('integrations').update({
        metadata: { ...rest, last_groups_attendance_sync_at: new Date().toISOString() }
      }).eq('id', integrationId);
      // Recalculate engagement scores when sync completes
      await supabase.rpc('calculate_engagement_scores', { p_org_id: orgId });
    }

    return new Response(JSON.stringify({
      success: true, hasMore,
      processedGroups: slice.length, totalGroups: all.length,
      meetingsUpserted, attendancesUpserted,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('pco-sync-group-attendance error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

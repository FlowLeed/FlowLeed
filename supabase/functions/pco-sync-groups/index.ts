// Syncs Planning Center Groups + Memberships into FlowLeed.
// Pattern mirrors pco-sync-checkins: chunked, rate-limited, resumable.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const API_DELAY = 350;
const MAX_GROUPS_PER_RUN = 50; // memberships per group can be many → cap groups per invocation

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
  throw new Error('PCO fetch failed after retries');
}

async function fetchAllPages(startUrl: string, auth: string, maxPages = 50): Promise<any[]> {
  const all: any[] = [];
  let url: string | null = startUrl;
  let pages = 0;
  while (url && pages < maxPages) {
    pages++;
    const res = await pcoFetch(url, auth);
    if (!res.ok) {
      if (res.status === 401) throw new Error('PCO_AUTH_FAILED');
      throw new Error(`PCO ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    all.push({ data: json.data || [], included: json.included || [] });
    url = json.links?.next || null;
    if (url) await sleep(API_DELAY);
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    const { integrationId } = await req.json();
    if (!integrationId) {
      return new Response(JSON.stringify({ error: 'integrationId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials, organization_id, metadata')
      .eq('id', integrationId).single();
    if (!integration) {
      return new Response(JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const creds = integration.credentials as any;
    if (!creds?.application_id || !creds?.secret) {
      return new Response(JSON.stringify({ error: 'Missing PCO credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const auth = btoa(`${creds.application_id}:${creds.secret}`);
    const orgId = integration.organization_id;
    const metadata = (integration.metadata as any) || {};

    // ----- 1. Sync groups list -----
    console.log(`[groups-sync] org ${orgId} — fetching groups`);
    const groupPages = await fetchAllPages(
      'https://api.planningcenteronline.com/groups/v2/groups?per_page=100&include=group_type,location',
      auth, 20
    );

    const pcoGroupIds = new Set<string>();
    const groupRows: any[] = [];
    for (const page of groupPages) {
      const includedGT = page.included.filter((i: any) => i.type === 'GroupType');
      const includedLoc = page.included.filter((i: any) => i.type === 'Location');
      for (const g of page.data) {
        const attrs = g.attributes || {};
        const rel = g.relationships || {};
        const gtId = rel.group_type?.data?.id;
        const locId = rel.location?.data?.id;
        const gt = includedGT.find((x: any) => x.id === gtId);
        const loc = includedLoc.find((x: any) => x.id === locId);
        pcoGroupIds.add(g.id);
        groupRows.push({
          organization_id: orgId,
          pco_group_id: g.id,
          name: attrs.name || 'Untitled Group',
          description: attrs.description || null,
          image_url: attrs.header_image?.thumbnail || attrs.header_image?.original || null,
          status: attrs.archived_at ? 'archived' : 'active',
          archived_at: attrs.archived_at || null,
          pco_group_type_id: gtId || null,
          pco_group_type_name: gt?.attributes?.name || null,
          pco_location_id: locId || null,
          location: loc?.attributes?.full_formatted_address || loc?.attributes?.name || null,
          last_synced_at: new Date().toISOString(),
          metadata: { pco_url: attrs.public_church_center_web_url || null },
        });
      }
    }

    // Upsert groups
    let groupsUpserted = 0;
    if (groupRows.length) {
      for (let i = 0; i < groupRows.length; i += 50) {
        const { error } = await supabase
          .from('groups')
          .upsert(groupRows.slice(i, i + 50), { onConflict: 'organization_id,pco_group_id' });
        if (error) console.error('groups upsert error', error.message);
        else groupsUpserted += Math.min(50, groupRows.length - i);
      }
    }

    // Soft-archive groups removed from PCO
    if (pcoGroupIds.size) {
      const { data: existing } = await supabase
        .from('groups')
        .select('id, pco_group_id')
        .eq('organization_id', orgId)
        .not('pco_group_id', 'is', null)
        .is('archived_at', null);
      const toArchive = (existing || []).filter(g => !pcoGroupIds.has(g.pco_group_id!));
      if (toArchive.length) {
        await supabase
          .from('groups')
          .update({ archived_at: new Date().toISOString(), status: 'archived' })
          .in('id', toArchive.map(g => g.id));
      }
    }

    // ----- 2. Sync memberships per group (capped) -----
    // Resume from cursor index
    const cursorIdx = metadata.groups_membership_cursor_idx || 0;
    const allGroupIds = Array.from(pcoGroupIds);
    const batchSlice = allGroupIds.slice(cursorIdx, cursorIdx + MAX_GROUPS_PER_RUN);

    // Map pco_group_id → flowleed group_id and pc_person_id → contact_id
    const { data: groupMap } = await supabase
      .from('groups').select('id, pco_group_id')
      .eq('organization_id', orgId).in('pco_group_id', batchSlice);
    const gIdMap = new Map((groupMap || []).map(g => [g.pco_group_id!, g.id]));

    let membersUpserted = 0;
    for (const pcoGid of batchSlice) {
      const localGid = gIdMap.get(pcoGid);
      if (!localGid) continue;
      try {
        const pages = await fetchAllPages(
          `https://api.planningcenteronline.com/groups/v2/groups/${pcoGid}/memberships?per_page=100&include=person`,
          auth, 10
        );
        const memberRows: any[] = [];
        const personIds = new Set<string>();
        for (const p of pages) {
          for (const m of p.data) {
            const personId = m.relationships?.person?.data?.id;
            if (!personId) continue;
            personIds.add(personId);
            const attrs = m.attributes || {};
            const role = attrs.role === 'leader' ? 'leader'
                       : attrs.role === 'co_leader' ? 'co_leader'
                       : attrs.role === 'host' ? 'host' : 'member';
            memberRows.push({
              group_id: localGid,
              pco_membership_id: m.id,
              pco_person_id: personId,
              role,
              status: 'active',
              joined_at: attrs.joined_at || new Date().toISOString(),
              synced_at: new Date().toISOString(),
            });
          }
        }

        // Resolve contact_id by pc_person_id
        const contactMap = new Map<string, string>();
        if (personIds.size) {
          const ids = Array.from(personIds);
          for (let i = 0; i < ids.length; i += 100) {
            const { data: contacts } = await supabase
              .from('contacts').select('id, pc_person_id')
              .eq('organization_id', orgId).in('pc_person_id', ids.slice(i, i + 100));
            for (const c of contacts || []) if (c.pc_person_id) contactMap.set(c.pc_person_id, c.id);
          }
        }

        // Filter rows with no matched contact (group_members.contact_id is NOT NULL)
        const rowsWithContact = memberRows
          .filter(r => contactMap.has(r.pco_person_id))
          .map(r => ({ ...r, contact_id: contactMap.get(r.pco_person_id) }));

        if (rowsWithContact.length) {
          const { error } = await supabase
            .from('group_members')
            .upsert(rowsWithContact, { onConflict: 'pco_membership_id' });
          if (error) console.error(`members upsert (group ${pcoGid}):`, error.message);
          else membersUpserted += rowsWithContact.length;
        }

        // Update member_count on the group
        await supabase
          .from('groups')
          .update({ member_count: memberRows.length })
          .eq('id', localGid);
      } catch (e) {
        console.error(`group ${pcoGid} members error:`, (e as Error).message);
        if ((e as Error).message === 'PCO_AUTH_FAILED') throw e;
      }
    }

    const nextIdx = cursorIdx + MAX_GROUPS_PER_RUN;
    const hasMore = nextIdx < allGroupIds.length;
    const newMeta = hasMore
      ? { ...metadata, groups_membership_cursor_idx: nextIdx }
      : (() => { const { groups_membership_cursor_idx, ...rest } = metadata;
                return { ...rest, last_groups_sync_at: new Date().toISOString() }; })();

    await supabase.from('integrations').update({ metadata: newMeta }).eq('id', integrationId);

    return new Response(JSON.stringify({
      success: true, hasMore,
      groupsUpserted, membersUpserted,
      processedGroups: batchSlice.length, totalGroups: allGroupIds.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('pco-sync-groups error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

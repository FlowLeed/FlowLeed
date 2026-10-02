// Sync the calling user's PCO-visible people IDs into user_pco_visible_people.
// Auth: JWT required. The function reads the user's own user_pco_connections
// row, pages /people/v2/people using their personal token, and replaces the
// snapshot transactionally via replace_user_pco_visible_people RPC.

import { createClient } from '@supabase/supabase-js';
import { getUserPcoAuthHeader } from '../_shared/pco-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PCO_BASE = 'https://api.planningcenteronline.com';
const PAGE_DELAY_MS = 350;
const MAX_PAGES = 500; // safety cap (50k people)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    let organizationId: string | undefined = body?.organizationId;

    if (!organizationId) {
      const { data: m } = await admin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      organizationId = m?.organization_id;
    }
    if (!organizationId) return json({ error: 'No organization' }, 400);

    const { data: conn } = await admin
      .from('user_pco_connections')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (!conn) return json({ error: 'USER_PCO_NOT_CONNECTED' }, 412);
    if (conn.status !== 'active') return json({ error: 'USER_PCO_REAUTH_REQUIRED' }, 412);

    const header = await getUserPcoAuthHeader(admin, user.id, organizationId);

    const seen = new Set<string>();
    // Only sync active people — matches PCO's default People UI count and
    // excludes archived/inactive/deceased records.
    let next: string | null = `${PCO_BASE}/people/v2/people?per_page=100&fields[Person]=id&where[status]=active`;
    let pages = 0;

    while (next && pages < MAX_PAGES) {
      const res = await fetch(next, { headers: { Authorization: header } });
      if (res.status === 401) {
        await admin
          .from('user_pco_connections')
          .update({ status: 'reauth_required', updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('organization_id', organizationId);
        return json({ error: 'USER_PCO_REAUTH_REQUIRED' }, 401);
      }
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After') ?? '2');
        await sleep(Math.min(retryAfter * 1000, 10_000));
        continue;
      }
      if (!res.ok) {
        const txt = await res.text();
        console.error('[pco-sync-user-permissions] PCO error', res.status, txt);
        return json({ error: `PCO ${res.status}`, detail: txt.slice(0, 200) }, 502);
      }
      const j = await res.json();
      for (const p of (j.data ?? [])) if (p?.id) seen.add(String(p.id));
      next = j?.links?.next ?? null;
      pages += 1;
      if (next) await sleep(PAGE_DELAY_MS);
    }

    const ids = [...seen];
    const { data: count, error: rpcErr } = await admin.rpc('replace_user_pco_visible_people', {
      _user: user.id,
      _org: organizationId,
      _ids: ids,
    });
    if (rpcErr) {
      console.error('[pco-sync-user-permissions] rpc failed', rpcErr);
      return json({ error: rpcErr.message }, 500);
    }

    console.log('[pco-sync-user-permissions] ok', { user: user.id, pages, count });
    return json({ ok: true, count, pages });
  } catch (e) {
    console.error('[pco-sync-user-permissions] error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

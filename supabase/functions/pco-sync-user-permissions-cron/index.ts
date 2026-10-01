// Daily background job: refresh user_pco_visible_people for every user with
// an active personal PCO connection. Triggered by pg_cron via net.http_post.
// No JWT required — protected by the CRON_SECRET header.

import { createClient } from '@supabase/supabase-js';
import { getUserPcoAuthHeader } from '../_shared/pco-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const PCO_BASE = 'https://api.planningcenteronline.com';
const PAGE_DELAY_MS = 350;
const MAX_PAGES = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    const provided = req.headers.get('x-cron-secret');
    if (cronSecret && provided !== cronSecret) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: connections, error } = await admin
      .from('user_pco_connections')
      .select('user_id, organization_id')
      .eq('status', 'active');
    if (error) throw error;

    const results: Array<{ user_id: string; ok: boolean; count?: number; error?: string }> = [];

    for (const c of connections ?? []) {
      try {
        const header = await getUserPcoAuthHeader(admin, c.user_id, c.organization_id);
        const seen = new Set<string>();
        let next: string | null = `${PCO_BASE}/people/v2/people?per_page=100&fields[Person]=id&where[status]=active`;
        let pages = 0;

        while (next && pages < MAX_PAGES) {
          const res = await fetch(next, { headers: { Authorization: header } });
          if (res.status === 401) {
            await admin
              .from('user_pco_connections')
              .update({ status: 'reauth_required', updated_at: new Date().toISOString() })
              .eq('user_id', c.user_id)
              .eq('organization_id', c.organization_id);
            throw new Error('reauth_required');
          }
          if (res.status === 429) {
            const retryAfter = Number(res.headers.get('Retry-After') ?? '2');
            await sleep(Math.min(retryAfter * 1000, 10_000));
            continue;
          }
          if (!res.ok) throw new Error(`PCO ${res.status}`);
          const j = await res.json();
          for (const p of (j.data ?? [])) if (p?.id) seen.add(String(p.id));
          next = j?.links?.next ?? null;
          pages += 1;
          if (next) await sleep(PAGE_DELAY_MS);
        }

        const { data: count, error: rpcErr } = await admin.rpc('replace_user_pco_visible_people', {
          _user: c.user_id,
          _org: c.organization_id,
          _ids: [...seen],
        });
        if (rpcErr) throw rpcErr;
        results.push({ user_id: c.user_id, ok: true, count: count as number });
      } catch (e) {
        results.push({ user_id: c.user_id, ok: false, error: (e as Error).message });
      }
    }

    return json({ ok: true, processed: results.length, results });
  } catch (e) {
    console.error('[pco-sync-user-permissions-cron] error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

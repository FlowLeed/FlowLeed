// Nightly safety net: recompute signal (marker) results for every organization
// that has contacts, so counts never go stale if an import is skipped.
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, name');

    if (error) throw error;

    let ok = 0;
    const failed: string[] = [];

    for (const org of orgs || []) {
      const { count } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', org.id);

      if (!count) continue;

      const { error: rpcError } = await supabase.rpc('recompute_contact_markers', {
        p_org_id: org.id,
      });

      if (rpcError) {
        console.error(`[recompute-markers-cron] org ${org.id} failed: ${rpcError.message}`);
        failed.push(org.id);
      } else {
        ok++;
      }
    }

    console.log(`[recompute-markers-cron] recomputed ${ok} org(s), ${failed.length} failed`);

    return new Response(JSON.stringify({ success: true, recomputed: ok, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[recompute-markers-cron] error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

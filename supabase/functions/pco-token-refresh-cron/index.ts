// Pre-refreshes PCO OAuth tokens (org integrations + user connections)
// whose access_token expires within 24 hours. Runs daily via pg_cron.
import { createClient } from '@supabase/supabase-js';
import { refreshOrgToken, refreshUserToken } from '../_shared/pco-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const horizon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const results = { orgs_refreshed: 0, orgs_failed: 0, users_refreshed: 0, users_failed: 0 };

    // Org integrations
    const { data: orgs } = await supabase
      .from('integrations')
      .select('id')
      .eq('service_name', 'planning_center')
      .eq('auth_type', 'oauth')
      .neq('status', 'reauth_required')
      .lt('oauth_token_expires_at', horizon);

    for (const o of orgs ?? []) {
      try {
        await refreshOrgToken(supabase, o.id);
        results.orgs_refreshed++;
      } catch (e) {
        console.warn('[refresh-cron] org', o.id, (e as Error).message);
        results.orgs_failed++;
      }
    }

    // User connections
    const { data: users } = await supabase
      .from('user_pco_connections')
      .select('user_id, organization_id')
      .eq('status', 'active')
      .lt('oauth_token_expires_at', horizon);

    for (const u of users ?? []) {
      try {
        await refreshUserToken(supabase, u.user_id, u.organization_id);
        results.users_refreshed++;
      } catch (e) {
        console.warn('[refresh-cron] user', u.user_id, (e as Error).message);
        results.users_failed++;
      }
    }

    console.log('[pco-token-refresh-cron]', results);
    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[pco-token-refresh-cron] error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

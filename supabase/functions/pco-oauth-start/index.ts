// Starts a PCO OAuth handshake.
// Body: { organizationId: string, purpose: 'org' | 'user', redirectOrigin: string }
// Returns: { authorizeUrl: string }
//
// For purpose='org', caller must be owner/admin of the organization.
// For purpose='user', any authenticated org member can initiate.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { PCO_OAUTH_SCOPES } from '../_shared/pco-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PCO_AUTHORIZE_URL = 'https://api.planningcenteronline.com/oauth/authorize';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const { organizationId, purpose, redirectOrigin, forceAccountSelect } = body as {
      organizationId?: string; purpose?: string; redirectOrigin?: string; forceAccountSelect?: boolean;
    };
    if (!organizationId || !purpose || !redirectOrigin) {
      return json({ error: 'organizationId, purpose, redirectOrigin required' }, 400);
    }
    if (purpose !== 'org' && purpose !== 'user') {
      return json({ error: "purpose must be 'org' or 'user'" }, 400);
    }

    // Membership + role check
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) return json({ error: 'Forbidden' }, 403);
    if (purpose === 'org' && !['owner', 'admin'].includes(membership.role)) {
      return json({ error: 'Only owners and admins can connect the organization' }, 403);
    }

    // Generate state + OIDC nonce, store CSRF row
    const state = crypto.randomUUID() + '-' + crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const { error: stateErr } = await supabase.from('pco_oauth_states').insert({
      state,
      nonce,
      organization_id: organizationId,
      user_id: user.id,
      purpose,
      redirect_to: redirectOrigin,
    });
    if (stateErr) {
      console.error('[pco-oauth-start] state insert failed', stateErr);
      return json({ error: 'Failed to create OAuth state' }, 500);
    }

    const clientId = Deno.env.get('PCO_OAUTH_CLIENT_ID');
    if (!clientId) return json({ error: 'PCO OAuth not configured' }, 500);

    const redirectUri = `${redirectOrigin.replace(/\/$/, '')}/pco/callback`;
    const url = new URL(PCO_AUTHORIZE_URL);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', PCO_OAUTH_SCOPES);
    url.searchParams.set('state', state);
    // Ask PCO to show its account chooser instead of silently reusing the
    // browser's existing Planning Center session (matters for people who
    // administer several PCO organizations).
    if (forceAccountSelect) url.searchParams.set('prompt', 'select_account');

    return json({ authorizeUrl: url.toString() });
  } catch (e) {
    console.error('[pco-oauth-start] error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

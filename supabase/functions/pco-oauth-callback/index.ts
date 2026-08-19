// Completes a PCO OAuth handshake (org or user).
// Body: { code: string, state: string, redirectOrigin: string }
// Returns: { ok: true, purpose, providerAccountName }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PCO_TOKEN_URL = 'https://api.planningcenteronline.com/oauth/token';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
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
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const { code, state, redirectOrigin } = body as {
      code?: string; state?: string; redirectOrigin?: string;
    };
    if (!code || !state || !redirectOrigin) {
      return json({ error: 'code, state, redirectOrigin required' }, 400);
    }

    // Validate state
    const { data: stateRow, error: stateErr } = await supabase
      .from('pco_oauth_states')
      .select('*')
      .eq('state', state)
      .maybeSingle();
    if (stateErr || !stateRow) return json({ error: 'Invalid state' }, 400);
    if (stateRow.consumed_at) return json({ error: 'State already used' }, 400);
    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      return json({ error: 'State expired' }, 400);
    }
    if (stateRow.user_id !== user.id) return json({ error: 'State user mismatch' }, 403);

    // Mark consumed early to prevent replay
    await supabase
      .from('pco_oauth_states')
      .update({ consumed_at: new Date().toISOString() })
      .eq('state', state);

    // Exchange code → tokens
    const clientId = Deno.env.get('PCO_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('PCO_OAUTH_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      console.error('[pco-oauth-callback] missing PCO_OAUTH_CLIENT_ID/SECRET env');
      return json({ error: 'PCO OAuth not configured (missing client id/secret)' }, 500);
    }
    const redirectUri = `${redirectOrigin.replace(/\/$/, '')}/pco/callback`;
    console.log('[pco-oauth-callback] exchanging code', { redirectUri, purpose: stateRow.purpose });

    const tokRes = await fetch(PCO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokRes.ok) {
      const txt = await tokRes.text();
      console.error('[pco-oauth-callback] token exchange failed', tokRes.status, txt);
      return json({ error: 'Token exchange failed', detail: txt }, 400);
    }
    const tok = await tokRes.json();
    console.log('[pco-oauth-callback] got tokens, scope=', tok.scope);
    const accessToken = tok.access_token as string;
    const refreshToken = tok.refresh_token as string;
    const expiresAt = new Date(Date.now() + (tok.expires_in ?? 7200) * 1000).toISOString();
    const scopes = tok.scope as string | undefined;

    // OpenID Connect: PCO returns an id_token that names the organization the
    // user picked in PCO's own account chooser. The token arrives over the
    // back-channel (TLS, client-secret authenticated), so we verify the nonce
    // rather than the signature.
    let idOrgId: string | null = null;
    let idOrgName: string | null = null;
    if (typeof tok.id_token === 'string') {
      const claims = decodeJwtPayload(tok.id_token);
      if (claims) {
        if (stateRow.nonce && claims.nonce && claims.nonce !== stateRow.nonce) {
          console.error('[pco-oauth-callback] nonce mismatch');
          return json({ error: 'Nonce mismatch — please start the connection again' }, 400);
        }
        idOrgId = claims.organization_id ? String(claims.organization_id) : null;
        idOrgName = claims.organization_name ? String(claims.organization_name) : null;
      }
    }


    // Fetch /me to identify provider account
    const meRes = await fetch(
      'https://api.planningcenteronline.com/people/v2/me?include=organization',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!meRes.ok) {
      const txt = await meRes.text();
      console.error('[pco-oauth-callback] /me failed', meRes.status, txt);
      return json({ error: 'Failed to load PCO profile', detail: txt }, 502);
    }
    const meJson = await meRes.json();
    console.log('[pco-oauth-callback] /me ok', { hasIncluded: !!meJson?.included });
    const pcPersonId: string = meJson?.data?.id ?? '';
    const email: string | null = meJson?.data?.attributes?.email_addresses?.[0]?.address
      ?? meJson?.data?.attributes?.login_identifier
      ?? null;
    const orgRel = meJson?.data?.relationships?.organization?.data;
    // Prefer the id_token claims (they reflect the account the user actually
    // picked in PCO's chooser); fall back to /me.
    const providerAccountId: string | null = idOrgId ?? orgRel?.id ?? null;
    const orgInc = (meJson?.included ?? []).find((x: any) =>
      x.type === 'Organization' && x.id === (orgRel?.id ?? providerAccountId));
    const providerAccountName: string | null = idOrgName ?? orgInc?.attributes?.name ?? null;


    if (stateRow.purpose === 'org') {
      // Find or create integration row
      const { data: existing } = await supabase
        .from('integrations')
        .select('id, provider_account_id, provider_account_name, auth_type')
        .eq('organization_id', stateRow.organization_id)
        .eq('service_name', 'planning_center')
        .maybeSingle();

      // Account-mismatch guard
      if (existing?.provider_account_id && providerAccountId
          && existing.provider_account_id !== providerAccountId) {
        return json({
          error: 'account_mismatch',
          message: `This Planning Center account (${providerAccountName ?? providerAccountId}) does not match the previously connected account (${existing.provider_account_name ?? existing.provider_account_id}). Disconnect first if this is intentional.`,
        }, 409);
      }

      // First-time connections wait for the admin to confirm the Planning
      // Center organization they picked before any syncing starts.
      const needsConfirmation = !existing?.provider_account_id;

      const baseFields = {
        auth_type: 'oauth',
        status: needsConfirmation ? 'pending_confirmation' : 'active',
        oauth_access_token: accessToken,
        oauth_refresh_token: refreshToken,
        oauth_token_expires_at: expiresAt,
        oauth_scopes: scopes,
        oauth_connected_by_user_id: user.id,
        provider_account_id: providerAccountId,
        provider_account_name: providerAccountName,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error: upErr } = await supabase
          .from('integrations')
          .update(baseFields)
          .eq('id', existing.id);
        if (upErr) {
          console.error('[pco-oauth-callback] integrations update failed', upErr);
          return json({ error: 'integrations update failed', detail: upErr.message }, 500);
        }
      } else {
        const { error: insErr } = await supabase.from('integrations').insert({
          ...baseFields,
          user_id: user.id,
          organization_id: stateRow.organization_id,
          service_name: 'planning_center',
          credentials: {},
          settings: {},
          sync_frequency: 'daily',
        });
        if (insErr) {
          console.error('[pco-oauth-callback] integrations insert failed', insErr);
          return json({ error: 'integrations insert failed', detail: insErr.message }, 500);
        }
      }

      console.log('[pco-oauth-callback] org connected ok');
      return json({ ok: true, purpose: 'org', providerAccountName });
    }

    // purpose === 'user'
    // Org-binding guard: org integration must already exist and match
    const { data: orgInteg } = await supabase
      .from('integrations')
      .select('provider_account_id, provider_account_name')
      .eq('organization_id', stateRow.organization_id)
      .eq('service_name', 'planning_center')
      .maybeSingle();
    if (!orgInteg?.provider_account_id) {
      return json({
        error: 'org_not_connected',
        message: 'Your organization must connect Planning Center first.',
      }, 412);
    }
    if (providerAccountId && providerAccountId !== orgInteg.provider_account_id) {
      return json({
        error: 'account_mismatch',
        message: `This Planning Center account (${providerAccountName ?? providerAccountId}) does not match this FlowLeed organization (${orgInteg.provider_account_name ?? orgInteg.provider_account_id}).`,
      }, 409);
    }

    const { error: upsertErr } = await supabase
      .from('user_pco_connections')
      .upsert({
        user_id: user.id,
        organization_id: stateRow.organization_id,
        pc_person_id: pcPersonId || null,
        email,
        oauth_access_token: accessToken,
        oauth_refresh_token: refreshToken,
        oauth_token_expires_at: expiresAt,
        oauth_scopes: scopes,
        status: 'active',
        provider_account_id: providerAccountId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,organization_id' });
    if (upsertErr) return json({ error: upsertErr.message }, 500);

    return json({ ok: true, purpose: 'user', providerAccountName });
  } catch (e) {
    console.error('[pco-oauth-callback] error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

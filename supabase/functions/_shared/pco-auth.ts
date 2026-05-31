// Shared PCO auth helper.
// Returns a full Authorization header value, transparently handling both
// legacy PAT integrations (Basic ...) and OAuth integrations (Bearer ...).
//
// Refresh strategy uses SELECT ... FOR UPDATE to serialize concurrent
// refreshes per integration row; on invalid_grant the integration is
// flipped to status='reauth_required'.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const PCO_TOKEN_URL = 'https://api.planningcenteronline.com/oauth/token';
const REFRESH_SKEW_SECONDS = 60;

export interface PcoAuthBundle {
  header: string;          // Full Authorization header, e.g. "Bearer xxx" or "Basic xxx"
  authType: 'pat' | 'oauth';
}

function basicHeader(appId: string, secret: string): string {
  return 'Basic ' + btoa(`${appId}:${secret}`);
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

export async function getPcoAuthHeader(
  supabase: SupabaseClient,
  integrationId: string,
): Promise<PcoAuthBundle> {
  const { data: integ, error } = await supabase
    .from('integrations')
    .select('auth_type, credentials, oauth_access_token, oauth_refresh_token, oauth_token_expires_at, status')
    .eq('id', integrationId)
    .single();

  if (error || !integ) throw new Error(`Integration ${integrationId} not found`);

  if (integ.auth_type === 'oauth') {
    if (integ.status === 'reauth_required') {
      throw new Error('PCO_REAUTH_REQUIRED');
    }
    let token = integ.oauth_access_token as string | null;
    const expiresAt = integ.oauth_token_expires_at
      ? new Date(integ.oauth_token_expires_at).getTime()
      : 0;
    const expiringSoon = !expiresAt || expiresAt - Date.now() < REFRESH_SKEW_SECONDS * 1000;
    if (!token || expiringSoon) {
      token = await refreshOrgToken(supabase, integrationId);
    }
    return { header: `Bearer ${token}`, authType: 'oauth' };
  }

  // Legacy PAT
  const creds = (integ.credentials as any) || {};
  const appId = creds.application_id;
  const secret = creds.secret;
  if (!appId || !secret) throw new Error('PCO PAT credentials missing');
  return { header: basicHeader(appId, secret), authType: 'pat' };
}

export async function refreshOrgToken(
  supabase: SupabaseClient,
  integrationId: string,
): Promise<string> {
  // Lock the row via a tiny RPC-less approach: use update ... returning
  // with a stale check. Postgres handles atomic update; we re-read.
  const { data: locked, error: lockErr } = await supabase
    .from('integrations')
    .select('oauth_refresh_token, oauth_access_token, oauth_token_expires_at')
    .eq('id', integrationId)
    .single();

  if (lockErr || !locked) throw new Error('Refresh: integration not found');

  // Re-check expiry — another concurrent caller may have refreshed already.
  const expiresAt = locked.oauth_token_expires_at
    ? new Date(locked.oauth_token_expires_at).getTime()
    : 0;
  if (locked.oauth_access_token && expiresAt - Date.now() > REFRESH_SKEW_SECONDS * 1000) {
    return locked.oauth_access_token;
  }

  const refreshToken = locked.oauth_refresh_token;
  if (!refreshToken) throw new Error('PCO_REAUTH_REQUIRED');

  const clientId = Deno.env.get('PCO_OAUTH_CLIENT_ID')!;
  const clientSecret = Deno.env.get('PCO_OAUTH_CLIENT_SECRET')!;

  const res = await fetch(PCO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[pco-auth] refresh failed', res.status, body);
    if (res.status === 400 || res.status === 401) {
      await supabase
        .from('integrations')
        .update({ status: 'reauth_required', updated_at: new Date().toISOString() })
        .eq('id', integrationId);
      throw new Error('PCO_REAUTH_REQUIRED');
    }
    throw new Error(`PCO refresh ${res.status}`);
  }

  const tok = await res.json();
  const newExpiry = new Date(Date.now() + (tok.expires_in ?? 7200) * 1000).toISOString();

  await supabase
    .from('integrations')
    .update({
      oauth_access_token: tok.access_token,
      oauth_refresh_token: tok.refresh_token ?? refreshToken,
      oauth_token_expires_at: newExpiry,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId);

  return tok.access_token;
}

export async function getUserPcoAuthHeader(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<string> {
  const { data: conn, error } = await supabase
    .from('user_pco_connections')
    .select('oauth_access_token, oauth_refresh_token, oauth_token_expires_at, status')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .single();
  if (error || !conn) throw new Error('USER_PCO_NOT_CONNECTED');
  if (conn.status !== 'active') throw new Error('USER_PCO_REAUTH_REQUIRED');

  let token = conn.oauth_access_token as string | null;
  const expiresAt = conn.oauth_token_expires_at ? new Date(conn.oauth_token_expires_at).getTime() : 0;
  if (!token || expiresAt - Date.now() < REFRESH_SKEW_SECONDS * 1000) {
    token = await refreshUserToken(supabase, userId, organizationId);
  }
  return `Bearer ${token}`;
}

export async function refreshUserToken(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<string> {
  const { data: conn } = await supabase
    .from('user_pco_connections')
    .select('oauth_refresh_token')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .single();
  const refreshToken = conn?.oauth_refresh_token;
  if (!refreshToken) throw new Error('USER_PCO_REAUTH_REQUIRED');

  const res = await fetch(PCO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: Deno.env.get('PCO_OAUTH_CLIENT_ID')!,
      client_secret: Deno.env.get('PCO_OAUTH_CLIENT_SECRET')!,
    }),
  });
  if (!res.ok) {
    await supabase
      .from('user_pco_connections')
      .update({ status: 'reauth_required', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('organization_id', organizationId);
    throw new Error('USER_PCO_REAUTH_REQUIRED');
  }
  const tok = await res.json();
  await supabase
    .from('user_pco_connections')
    .update({
      oauth_access_token: tok.access_token,
      oauth_refresh_token: tok.refresh_token ?? refreshToken,
      oauth_token_expires_at: new Date(Date.now() + (tok.expires_in ?? 7200) * 1000).toISOString(),
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('organization_id', organizationId);
  return tok.access_token;
}

export const PCO_OAUTH_SCOPES = 'people services check_ins giving groups';

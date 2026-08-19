// Confirms (or rejects) a freshly authorized Planning Center organization.
// Body: { organizationId: string, action: 'confirm' | 'reject' }
// Only owners/admins of the FlowLeed organization may call it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const body = await req.json().catch(() => ({}));
    const { organizationId, action } = body as { organizationId?: string; action?: string };
    if (!organizationId || (action !== 'confirm' && action !== 'reject')) {
      return json({ error: "organizationId and action ('confirm' | 'reject') required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return json({ error: 'Forbidden' }, 403);
    }

    const { data: integ } = await supabase
      .from('integrations')
      .select('id, status, provider_account_name')
      .eq('organization_id', organizationId)
      .eq('service_name', 'planning_center')
      .maybeSingle();
    if (!integ) return json({ error: 'No Planning Center connection found' }, 404);
    if (integ.status !== 'pending_confirmation') {
      return json({ ok: true, status: integ.status });
    }

    if (action === 'reject') {
      const { error: delErr } = await supabase
        .from('integrations')
        .delete()
        .eq('id', integ.id);
      if (delErr) return json({ error: delErr.message }, 500);
      return json({ ok: true, status: 'disconnected' });
    }

    const { error: upErr } = await supabase
      .from('integrations')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', integ.id);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ ok: true, status: 'active', providerAccountName: integ.provider_account_name });
  } catch (e) {
    console.error('[pco-oauth-confirm] error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

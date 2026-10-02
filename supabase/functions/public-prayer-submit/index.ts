import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const body = await req.json();
    const orgSlug = String(body.org_slug ?? '').trim().slice(0, 100);
    if (!orgSlug) return json({ error: 'Missing church' }, 400);

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: org } = await sb.from('organizations').select('id, name, logo_url').eq('slug', orgSlug).maybeSingle();
    if (!org) return json({ error: 'Church not found' }, 404);

    if (body.mode === 'info') return json({ organization: { name: org.name, logo_url: org.logo_url } });
    if (body.honeypot) return json({ success: true });

    const kind = body.kind === 'praise' ? 'praise' : 'prayer';
    const text = String(body.request ?? '').trim().slice(0, 5000);
    const name = String(body.name ?? '').trim().slice(0, 200);
    const email = String(body.email ?? '').trim().toLowerCase().slice(0, 255) || null;
    const phoneRaw = String(body.phone ?? '').trim().slice(0, 50) || null;
    const isAnonymous = !!body.anonymous;
    if (text.length < 3) return json({ error: 'Please share your request' }, 400);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid email' }, 400);

    // Matching waterfall: email → phone digits → create new person (if a name was given)
    let contactId: string | null = null;
    if (email) {
      const { data } = await sb.from('contacts').select('id').eq('organization_id', org.id).ilike('email', email).limit(1);
      if (data?.length) contactId = data[0].id;
    }
    const digits = phoneRaw?.replace(/\D/g, '') ?? '';
    if (!contactId && digits.length >= 7) {
      const last10 = digits.slice(-10);
      const pattern = '%' + last10.split('').join('%') + '%';
      const { data } = await sb.from('contacts').select('id').eq('organization_id', org.id).ilike('phone', pattern).limit(1);
      if (data?.length) contactId = data[0].id;
    }
    if (!contactId && name && (email || phoneRaw)) {
      const { data: nc } = await sb.from('contacts')
        .insert({ organization_id: org.id, name, email, phone: phoneRaw, source_type: 'form', status: 'active' })
        .select('id').single();
      contactId = nc?.id ?? null;
    }

    const { error } = await sb.from('contact_prayer_requests').insert({
      organization_id: org.id,
      contact_id: contactId,
      description: text,
      kind,
      status: kind === 'praise' ? 'answered' : 'active',
      is_anonymous: isAnonymous,
      source: 'public',
      submitter_name: name || null,
    });
    if (error) {
      console.error('insert error', error);
      return json({ error: 'Could not save your request' }, 500);
    }
    return json({ success: true });
  } catch (e) {
    console.error(e);
    return json({ error: 'Something went wrong' }, 500);
  }
});

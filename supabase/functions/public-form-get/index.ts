import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function isPreviewAuthorized(
  admin: any,
  authHeader: string | null,
  organizationId: string,
): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice('Bearer '.length);
  try {
    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data?.user) return false;
    const userId = data.user.id;
    const { data: member } = await admin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle();
    return !!member;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const orgSlug = url.searchParams.get('org_slug');
    const preview = url.searchParams.get('preview') === '1' || url.searchParams.get('preview') === 'true';
    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let orgId: string | null = null;
    if (orgSlug) {
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', orgSlug)
        .maybeSingle();
      if (!orgRow) {
        return new Response(JSON.stringify({ error: 'Organization not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      orgId = orgRow.id;
    }

    // Look up form without the is_published filter first so we can decide preview access.
    let formQuery = supabase
      .from('forms')
      .select('id, name, description, slug, brand_color, logo_url, success_message, redirect_url, organization_id, is_published')
      .eq('slug', slug);
    if (orgId) formQuery = formQuery.eq('organization_id', orgId);
    const { data: form, error } = await formQuery.maybeSingle();

    if (error || !form) {
      return new Response(JSON.stringify({ error: 'Form not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let previewMode = false;
    if (!form.is_published) {
      if (!preview) {
        return new Response(JSON.stringify({ error: 'Form not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const ok = await isPreviewAuthorized(supabase, req.headers.get('Authorization'), form.organization_id);
      if (!ok) {
        return new Response(JSON.stringify({ error: 'Form not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      previewMode = true;
    }

    const [{ data: fields }, { data: org }] = await Promise.all([
      supabase
        .from('form_fields')
        .select('id, field_key, label, field_type, options, required, placeholder, help_text, sort_order')
        .eq('form_id', form.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('organizations')
        .select('name, logo_url, slug')
        .eq('id', form.organization_id)
        .maybeSingle(),
    ]);

    const toPublicLogoUrl = (v: string | null | undefined) => {
      if (!v) return null;
      if (/^https?:\/\//i.test(v)) return v;
      const { data } = supabase.storage.from('org-logos').getPublicUrl(v);
      return data.publicUrl;
    };

    return new Response(
      JSON.stringify({
        form: {
          id: form.id,
          name: form.name,
          description: form.description,
          slug: form.slug,
          brand_color: form.brand_color,
          logo_url: toPublicLogoUrl(form.logo_url),
          success_message: form.success_message,
          redirect_url: form.redirect_url,
        },
        fields: fields || [],
        organization: org
          ? { name: org.name, logo_url: toPublicLogoUrl(org.logo_url), slug: org.slug }
          : null,
        preview: previewMode,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('public-form-get error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

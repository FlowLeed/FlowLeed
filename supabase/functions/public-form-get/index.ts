import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const orgSlug = url.searchParams.get('org_slug');
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

    // Resolve org (if org_slug provided) — required for the new canonical URL,
    // optional for the legacy /f/:slug redirect lookup.
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

    let formQuery = supabase
      .from('forms')
      .select('id, name, description, slug, brand_color, logo_url, success_message, redirect_url, organization_id, is_published')
      .eq('slug', slug)
      .eq('is_published', true);

    if (orgId) formQuery = formQuery.eq('organization_id', orgId);

    const { data: form, error } = await formQuery.maybeSingle();

    if (error || !form) {
      return new Response(JSON.stringify({ error: 'Form not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    return new Response(
      JSON.stringify({
        form: {
          id: form.id,
          name: form.name,
          description: form.description,
          slug: form.slug,
          brand_color: form.brand_color,
          logo_url: form.logo_url,
          success_message: form.success_message,
          redirect_url: form.redirect_url,
        },
        fields: fields || [],
        organization: org
          ? { name: org.name, logo_url: org.logo_url, slug: org.slug }
          : null,
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

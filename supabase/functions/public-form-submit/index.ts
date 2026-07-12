import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { slug, org_slug, data, honeypot } = body as {
      slug?: string;
      org_slug?: string;
      data?: Record<string, any>;
      honeypot?: string;
    };

    if (honeypot) {
      // silently accept but do nothing
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!slug || !data || typeof data !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Resolve org (if provided) to disambiguate — form slugs are unique per org.
    let orgId: string | null = null;
    if (org_slug) {
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', org_slug)
        .maybeSingle();
      if (!orgRow) {
        return new Response(JSON.stringify({ error: 'Organization not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      orgId = orgRow.id;
    }

    // Load form + fields
    let formQuery = supabase
      .from('forms')
      .select('id, organization_id, pipeline_id, stage_id, is_published, success_message, redirect_url')
      .eq('slug', slug)
      .eq('is_published', true);
    if (orgId) formQuery = formQuery.eq('organization_id', orgId);

    const { data: form, error: formErr } = await formQuery.maybeSingle();

    if (formErr || !form) {
      return new Response(JSON.stringify({ error: 'Form not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: fields } = await supabase
      .from('form_fields')
      .select('field_key, label, field_type, required')
      .eq('form_id', form.id);

    // Validate required
    for (const f of fields || []) {
      if (f.required) {
        const v = data[f.field_key];
        if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
          return new Response(JSON.stringify({ error: `${f.label} is required` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const name = String(data.name ?? '').trim().slice(0, 200);
    const email = String(data.email ?? '').trim().toLowerCase().slice(0, 255) || null;
    const phone = String(data.phone ?? '').trim().slice(0, 50) || null;

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find existing contact by email or phone in org
    let contactId: string | null = null;
    if (email || phone) {
      const filters: string[] = [];
      if (email) filters.push(`email.ilike.${email}`);
      if (phone) filters.push(`phone.eq.${phone}`);
      const { data: existing } = await supabase
        .from('contacts')
        .select('id, email, phone, name')
        .eq('organization_id', form.organization_id)
        .or(filters.join(','))
        .limit(1);
      if (existing && existing.length > 0) {
        contactId = existing[0].id;
        const patch: Record<string, any> = {};
        if (!existing[0].email && email) patch.email = email;
        if (!existing[0].phone && phone) patch.phone = phone;
        if (Object.keys(patch).length > 0) {
          await supabase.from('contacts').update(patch).eq('id', contactId);
        }
      }
    }

    if (!contactId) {
      const { data: newContact, error: insErr } = await supabase
        .from('contacts')
        .insert({
          organization_id: form.organization_id,
          name,
          email,
          phone,
          source_type: 'form',
          status: 'active',
        })
        .select('id')
        .single();
      if (insErr || !newContact) {
        console.error('contact insert error', insErr);
        return new Response(JSON.stringify({ error: 'Failed to create contact' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      contactId = newContact.id;
    }

    // Insert submission
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const ua = req.headers.get('user-agent') || null;
    await supabase.from('form_submissions').insert({
      form_id: form.id,
      organization_id: form.organization_id,
      contact_id: contactId,
      data,
      ip,
      user_agent: ua,
    });

    await supabase.rpc('increment_form_submission_count' as any, { p_form_id: form.id }).then(
      () => {},
      async () => {
        // fallback if RPC not present
        const { data: cur } = await supabase.from('forms').select('submission_count').eq('id', form.id).maybeSingle();
        await supabase.from('forms').update({ submission_count: (cur?.submission_count || 0) + 1 }).eq('id', form.id);
      },
    );

    // Enroll in flow
    let assigneeUserId: string | null = null;
    if (form.pipeline_id && form.stage_id) {
      const { data: stage } = await supabase
        .from('pipeline_stages')
        .select('stage_order, default_assignee_user_id')
        .eq('id', form.stage_id)
        .maybeSingle();

      assigneeUserId = stage?.default_assignee_user_id ?? null;

      // If no default assignee, use pipeline lead
      if (!assigneeUserId) {
        const { data: lead } = await supabase
          .from('pipeline_team_members')
          .select('user_id')
          .eq('pipeline_id', form.pipeline_id)
          .eq('role', 'lead')
          .limit(1)
          .maybeSingle();
        assigneeUserId = lead?.user_id ?? null;
      }

      // Only insert if not already enrolled
      const { data: existingEnroll } = await supabase
        .from('pipeline_contacts')
        .select('id')
        .eq('pipeline_id', form.pipeline_id)
        .eq('contact_id', contactId)
        .maybeSingle();

      if (!existingEnroll) {
        await supabase.from('pipeline_contacts').insert({
          pipeline_id: form.pipeline_id,
          contact_id: contactId,
          stage_id: form.stage_id,
          stage_order: stage?.stage_order ?? 0,
          assigned_to_user_id: assigneeUserId,
          source_type: 'form',
          source_id: form.id,
        });
      }

      // Notify assignee
      if (assigneeUserId) {
        await supabase.from('notifications').insert({
          user_id: assigneeUserId,
          organization_id: form.organization_id,
          contact_id: contactId,
          pipeline_id: form.pipeline_id,
          type: 'form_submission',
          title: 'New form submission',
          message: `${name} submitted a form`,
          metadata: { form_id: form.id, slug },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: form.success_message,
        redirect_url: form.redirect_url,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('public-form-submit error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

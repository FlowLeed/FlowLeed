import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_RE = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const clean = (s: unknown, max: number) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);

async function sendFormEmails(opts: {
  settings: any;
  formName: string;
  orgName: string;
  fields: { field_key: string; label: string; field_type: string }[];
  data: Record<string, any>;
  name: string;
  email: string | null;
}) {
  const { settings, formName, orgName, fields, data, name, email } = opts;
  const conf = settings?.confirmation;
  const notify = settings?.notify;
  if (!conf?.enabled && !notify?.enabled) return;
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) { console.error('RESEND_API_KEY missing'); return; }

  const firstName = clean(data.first_name, 100) || name.split(' ')[0] || 'there';
  const fill = (t: string) =>
    t.replaceAll('{first_name}', firstName).replaceAll('{name}', name).replaceAll('{form_name}', formName).replaceAll('{org_name}', orgName);

  const skip = new Set(['heading', 'paragraph', 'divider']);
  const rows = fields
    .filter((f) => !skip.has(f.field_type))
    .map((f) => {
      const v = data[f.field_key];
      const val = Array.isArray(v) ? v.join(', ') : v === true ? 'Yes' : v === false ? 'No' : String(v ?? '');
      return `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top">${esc(f.label)}</td><td style="padding:6px 0;color:#111">${esc(val) || '—'}</td></tr>`;
    })
    .join('');
  const answers = `<table style="border-collapse:collapse;font-size:14px;margin-top:12px">${rows}</table>`;
  const wrap = (inner: string) =>
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;font-size:15px;line-height:1.6">${inner}<p style="margin-top:32px;color:#999;font-size:12px">Sent by FlowLeed</p></div>`;

  const send = async (payload: Record<string, unknown>) => {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) console.error('Resend error', r.status, await r.text());
  };

  const orgFrom = clean(orgName, 80).replace(/[<>"]/g, '') || 'FlowLeed';
  const fromName = clean(conf?.from_name, 80).replace(/[<>"]/g, '') || orgFrom;
  const from = `${fromName} <noreply@flowleed.com>`;

  if (conf?.enabled && email && EMAIL_RE.test(email)) {
    const subject = clean(fill(conf.subject || `{org_name}: Thanks for filling out {form_name}`), 200);
    const body = fill(String(conf.body || `Hi {first_name},\n\nThanks for filling out ${formName}. We'll be in touch soon.`)).slice(0, 5000);
    const html = wrap(
      esc(body).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('') +
        `<p style="margin-top:24px;font-weight:600">Your answers</p>${answers}`,
    );
    const replyTo = clean(conf.reply_to, 255);
    await send({ from, to: [email], subject, html, ...(EMAIL_RE.test(replyTo) ? { reply_to: replyTo } : {}) });
  }

  if (notify?.enabled) {
    const to = String(notify.recipients || '')
      .split(/[,;\s]+/)
      .map((s: string) => s.trim())
      .filter((s: string) => EMAIL_RE.test(s))
      .slice(0, 10);
    if (to.length) {
      const subject = clean(fill(notify.subject || `New submission: {form_name} from {name} ({org_name})`), 200);
      const html = wrap(`<p><strong>${esc(name)}</strong> just filled out <strong>${esc(formName)}</strong>.</p>${answers}`);
      await send({ from: `${orgFrom} <noreply@flowleed.com>`, to, subject, html, ...(email && EMAIL_RE.test(email) ? { reply_to: email } : {}) });
    }
  }
}


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
    const { slug, org_slug, data, honeypot, preview } = body as {
      slug?: string;
      org_slug?: string;
      data?: Record<string, any>;
      honeypot?: string;
      preview?: boolean;
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

    // Load form + fields (no is_published filter yet — preview may bypass).
    let formQuery = supabase
      .from('forms')
      .select('id, name, organization_id, pipeline_id, stage_id, is_published, success_message, redirect_url, email_settings')
      .eq('slug', slug);
    if (orgId) formQuery = formQuery.eq('organization_id', orgId);

    const { data: form, error: formErr } = await formQuery.maybeSingle();

    if (formErr || !form) {
      return new Response(JSON.stringify({ error: 'Form not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Preview-mode auth for unpublished forms
    let previewMode = false;
    if (!form.is_published) {
      if (!preview) {
        return new Response(JSON.stringify({ error: 'Form not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const authHeader = req.headers.get('Authorization');
      let authorized = false;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length);
        try {
          const anon = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
          );
          const { data: u } = await anon.auth.getUser(token);
          if (u?.user) {
            const { data: member } = await supabase
              .from('organization_members')
              .select('user_id')
              .eq('organization_id', form.organization_id)
              .eq('user_id', u.user.id)
              .maybeSingle();
            authorized = !!member;
          }
        } catch { /* ignore */ }
      }
      if (!authorized) {
        return new Response(JSON.stringify({ error: 'Form not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      previewMode = true;
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

    const firstName = String(data.first_name ?? '').trim().slice(0, 100);
    const lastName = String(data.last_name ?? '').trim().slice(0, 100);
    const legacyName = String(data.name ?? '').trim().slice(0, 200);
    const name = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : legacyName;

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
      is_preview: previewMode,
    });

    // Skip counters, flow enrollment and notifications in preview mode
    if (previewMode) {
      return new Response(
        JSON.stringify({
          success: true,
          preview: true,
          message: form.success_message,
          redirect_url: form.redirect_url,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

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


    try {
      const { data: orgRow } = await supabase.from('organizations').select('name').eq('id', form.organization_id).maybeSingle();
      await sendFormEmails({
        orgName: (orgRow as any)?.name || 'FlowLeed',
        settings: (form as any).email_settings || {},
        formName: (form as any).name || 'Form',
        fields: fields || [],
        data,
        name,
        email,
      });
    } catch (e) {
      console.error('form email error', e);
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

// CSV contact import: creates/updates people, enrolls them in a flow, and tracks the batch
// so it can be reviewed or undone.
//
// Actions:
//   start  { organizationId, fileName, totalRows, mapping, options, importTag, pipelineId?, stageId? } -> { importId }
//   batch  { importId, rows: MappedRow[] } -> { created, updated, enrolled, skipped }
//   finish { importId } -> { ok: true }
//   undo   { importId } -> { deleted, unenrolled }
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MappedRow {
  rowNumber: number;
  name: string;
  email: string | null;
  phone: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  birthday?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  occupation?: string | null;
  tags?: string[];
  campus?: string | null;
  assigned_email?: string | null;
  note?: string | null;
}

const digits = (v?: string | null) => {
  if (!v) return null;
  const d = String(v).replace(/\D/g, '');
  if (d.length < 7) return null;
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(
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
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    const assertMember = async (organizationId: string) => {
      const { data } = await admin
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .maybeSingle();
      return data?.role ?? null;
    };

    const loadImport = async (importId: string) => {
      const { data } = await admin
        .from('contact_imports')
        .select('*')
        .eq('id', importId)
        .maybeSingle();
      return data;
    };

    if (action === 'start') {
      const { organizationId, fileName, totalRows, mapping, options, importTag, pipelineId, stageId } = body;
      if (!organizationId || !fileName) return json({ error: 'organizationId and fileName required' }, 400);
      if (!(await assertMember(organizationId))) return json({ error: 'Forbidden' }, 403);

      const { data, error } = await admin
        .from('contact_imports')
        .insert({
          organization_id: organizationId,
          created_by_user_id: user.id,
          file_name: String(fileName).slice(0, 255),
          total_rows: Number(totalRows) || 0,
          mapping: mapping ?? {},
          options: options ?? {},
          import_tag: importTag ?? null,
          pipeline_id: pipelineId ?? null,
          stage_id: stageId ?? null,
          status: 'running',
        })
        .select('id')
        .single();
      if (error) throw error;
      return json({ importId: data.id });
    }

    if (action === 'batch') {
      const { importId, rows } = body as { importId: string; rows: MappedRow[] };
      if (!importId || !Array.isArray(rows)) return json({ error: 'importId and rows required' }, 400);
      const imp = await loadImport(importId);
      if (!imp) return json({ error: 'Import not found' }, 404);
      const role = await assertMember(imp.organization_id);
      if (!role) return json({ error: 'Forbidden' }, 403);

      const orgId = imp.organization_id as string;
      const importTag = imp.import_tag as string | null;
      const pipelineId = imp.pipeline_id as string | null;
      const stageId = imp.stage_id as string | null;

      // Stage order for enrollment
      let stageOrder = 0;
      if (stageId) {
        const { data: stage } = await admin
          .from('pipeline_stages')
          .select('stage_order')
          .eq('id', stageId)
          .maybeSingle();
        stageOrder = stage?.stage_order ?? 0;
      }

      // Lookup maps for campuses and staff
      const { data: campuses } = await admin
        .from('campuses')
        .select('id,name')
        .eq('organization_id', orgId);
      const campusByName = new Map(
        (campuses ?? []).map((c: any) => [String(c.name).trim().toLowerCase(), c.id]),
      );

      const { data: members } = await admin
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', orgId);
      const memberIds = (members ?? []).map((m: any) => m.user_id);
      const { data: profiles } = memberIds.length
        ? await admin.from('profiles').select('user_id,email').in('user_id', memberIds)
        : { data: [] as any[] };
      const staffByEmail = new Map(
        (profiles ?? [])
          .filter((p: any) => p.email)
          .map((p: any) => [String(p.email).trim().toLowerCase(), p.user_id]),
      );

      // Existing contacts for matching
      const emails = rows.map((r) => r.email).filter(Boolean) as string[];
      const phoneDigits = rows.map((r) => digits(r.phone)).filter(Boolean) as string[];

      const existing: any[] = [];
      if (emails.length) {
        const { data } = await admin
          .from('contacts')
          .select('id,name,email,phone,pc_person_id')
          .eq('organization_id', orgId)
          .in('email', emails);
        existing.push(...(data ?? []));
      }
      if (phoneDigits.length) {
        // Match on phone by pulling candidates with a loose filter, then compare digits
        const { data } = await admin
          .from('contacts')
          .select('id,name,email,phone,pc_person_id')
          .eq('organization_id', orgId)
          .not('phone', 'is', null)
          .limit(20000);
        for (const c of data ?? []) {
          const d = digits(c.phone);
          if (d && phoneDigits.includes(d)) existing.push(c);
        }
      }
      const byEmail = new Map<string, any>();
      const byPhone = new Map<string, any>();
      for (const c of existing) {
        if (c.email) byEmail.set(String(c.email).trim().toLowerCase(), c);
        const d = digits(c.phone);
        if (d) byPhone.set(d, c);
      }

      let created = 0;
      let updated = 0;
      let enrolled = 0;
      let skipped = 0;
      const rowRecords: any[] = [];

      for (const row of rows) {
        try {
          const match =
            (row.email && byEmail.get(row.email)) ||
            (digits(row.phone) && byPhone.get(digits(row.phone)!)) ||
            null;

          const campusId = row.campus
            ? campusByName.get(row.campus.trim().toLowerCase()) ?? null
            : null;
          const assignedUserId = row.assigned_email
            ? staffByEmail.get(row.assigned_email.trim().toLowerCase()) ?? null
            : null;

          let contactId: string;
          let outcome: string;

          if (match) {
            contactId = match.id;
            const isPco = !!match.pc_person_id;
            if (isPco) {
              outcome = 'enrolled_only';
            } else {
              const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
              if (row.name) patch.name = row.name;
              if (row.email) patch.email = row.email;
              if (row.phone) patch.phone = row.phone;
              if (campusId) patch.campus_id = campusId;
              if (assignedUserId) patch.assigned_to_user_id = assignedUserId;
              const { error } = await admin.from('contacts').update(patch).eq('id', contactId);
              if (error) throw error;
              updated += 1;
              outcome = 'updated';
            }
          } else {
            const { data: inserted, error } = await admin
              .from('contacts')
              .insert({
                organization_id: orgId,
                name: row.name,
                email: row.email,
                phone: row.phone,
                status: 'active',
                source_type: 'csv_import',
                campus_id: campusId,
                assigned_to_user_id: assignedUserId,
              })
              .select('id')
              .single();
            if (error) throw error;
            contactId = inserted.id;
            created += 1;
            outcome = 'created';
          }

          const isPcoManaged = !!match?.pc_person_id;

          // Profile extras (never overwrite PCO-managed people, never erase with blanks)
          if (!isPcoManaged) {
            if (row.birthday || row.gender || row.marital_status || row.occupation) {
              const { data: demo } = await admin
                .from('contact_demographics')
                .select('id,birthday,gender,marital_status,occupation')
                .eq('contact_id', contactId)
                .maybeSingle();
              const payload: Record<string, unknown> = {
                birthday: row.birthday ?? demo?.birthday ?? null,
                gender: row.gender ?? demo?.gender ?? null,
                marital_status: row.marital_status ?? demo?.marital_status ?? null,
                occupation: row.occupation ?? demo?.occupation ?? null,
              };
              if (demo) {
                await admin.from('contact_demographics').update(payload).eq('id', demo.id);
              } else {
                await admin.from('contact_demographics').insert({ contact_id: contactId, ...payload });
              }
            }

            if (row.street || row.city || row.state || row.zip || row.country) {
              const { data: addr } = await admin
                .from('contact_addresses')
                .select('id,street_address,city,state,zip_code,country')
                .eq('contact_id', contactId)
                .eq('is_primary', true)
                .maybeSingle();
              const payload: Record<string, unknown> = {
                street_address: row.street ?? addr?.street_address ?? null,
                city: row.city ?? addr?.city ?? null,
                state: row.state ?? addr?.state ?? null,
                zip_code: row.zip ?? addr?.zip_code ?? null,
                country: row.country ?? addr?.country ?? null,
              };
              if (addr) {
                await admin.from('contact_addresses').update(payload).eq('id', addr.id);
              } else {
                await admin.from('contact_addresses').insert({
                  contact_id: contactId,
                  address_type: 'home',
                  is_primary: true,
                  ...payload,
                });
              }
            }
          }

          // Tags (always allowed, including on PCO people)
          const tags = Array.from(new Set([...(row.tags ?? []), ...(importTag ? [importTag] : [])]))
            .map((t) => String(t).trim())
            .filter(Boolean);
          if (tags.length) {
            const { data: existingTags } = await admin
              .from('contact_tags')
              .select('tag')
              .eq('contact_id', contactId)
              .in('tag', tags);
            const have = new Set((existingTags ?? []).map((t: any) => t.tag));
            const inserts = tags.filter((t) => !have.has(t)).map((tag) => ({ contact_id: contactId, tag }));
            if (inserts.length) await admin.from('contact_tags').insert(inserts);
          }

          // Note
          if (row.note) {
            await admin.from('contact_notes').insert({
              contact_id: contactId,
              content: `${row.note}\n\n(Imported from CSV — ${imp.file_name})`,
              note_type: 'general',
              is_private: false,
              created_by_user_id: user.id,
            });
          }

          // Flow enrollment
          if (pipelineId && stageId) {
            const { data: already } = await admin
              .from('pipeline_contacts')
              .select('id')
              .eq('pipeline_id', pipelineId)
              .eq('contact_id', contactId)
              .maybeSingle();
            if (!already) {
              const { error: enrollErr } = await admin.from('pipeline_contacts').insert({
                pipeline_id: pipelineId,
                stage_id: stageId,
                contact_id: contactId,
                stage_order: stageOrder,
                assigned_to_user_id: assignedUserId,
                source_type: 'csv_import',
                source_id: importId,
                entered_start_at: new Date().toISOString(),
                stage_entered_at: new Date().toISOString(),
              });
              if (!enrollErr) enrolled += 1;
            }
          }

          rowRecords.push({
            import_id: importId,
            row_number: row.rowNumber,
            contact_id: contactId,
            outcome,
            reason: null,
          });
        } catch (rowErr) {
          skipped += 1;
          rowRecords.push({
            import_id: importId,
            row_number: row.rowNumber,
            contact_id: null,
            outcome: 'failed',
            reason: (rowErr as Error).message?.slice(0, 500) ?? 'Unknown error',
            raw: { name: row.name, email: row.email, phone: row.phone },
          });
        }
      }

      if (rowRecords.length) await admin.from('contact_import_rows').insert(rowRecords);

      await admin
        .from('contact_imports')
        .update({
          created_count: (imp.created_count ?? 0) + created,
          updated_count: (imp.updated_count ?? 0) + updated,
          enrolled_count: (imp.enrolled_count ?? 0) + enrolled,
          skipped_count: (imp.skipped_count ?? 0) + skipped,
        })
        .eq('id', importId);

      return json({ created, updated, enrolled, skipped });
    }

    if (action === 'finish') {
      const { importId, skippedRows } = body as { importId: string; skippedRows?: { rowNumber: number; reason: string }[] };
      const imp = await loadImport(importId);
      if (!imp) return json({ error: 'Import not found' }, 404);
      if (!(await assertMember(imp.organization_id))) return json({ error: 'Forbidden' }, 403);

      if (Array.isArray(skippedRows) && skippedRows.length) {
        await admin.from('contact_import_rows').insert(
          skippedRows.slice(0, 5000).map((r) => ({
            import_id: importId,
            row_number: r.rowNumber,
            outcome: 'skipped',
            reason: String(r.reason).slice(0, 500),
          })),
        );
        await admin
          .from('contact_imports')
          .update({ skipped_count: (imp.skipped_count ?? 0) + skippedRows.length })
          .eq('id', importId);
      }

      await admin.from('contact_imports').update({ status: 'completed' }).eq('id', importId);
      const { data: fresh } = await admin
        .from('contact_imports')
        .select('created_count,updated_count,enrolled_count,skipped_count')
        .eq('id', importId)
        .maybeSingle();
      return json({ ok: true, ...(fresh ?? {}) });
    }

    if (action === 'undo') {
      const { importId } = body as { importId: string };
      const imp = await loadImport(importId);
      if (!imp) return json({ error: 'Import not found' }, 404);
      const role = await assertMember(imp.organization_id);
      if (!role) return json({ error: 'Forbidden' }, 403);
      if (imp.created_by_user_id !== user.id && !['owner', 'admin'].includes(role)) {
        return json({ error: 'Only the person who ran this import (or an admin) can undo it' }, 403);
      }
      if (imp.undone_at) return json({ error: 'This import was already undone' }, 400);

      const { data: rows } = await admin
        .from('contact_import_rows')
        .select('contact_id,outcome')
        .eq('import_id', importId);

      const createdIds = (rows ?? []).filter((r: any) => r.outcome === 'created' && r.contact_id).map((r: any) => r.contact_id);
      const touchedIds = (rows ?? []).filter((r: any) => r.contact_id).map((r: any) => r.contact_id);

      let unenrolled = 0;
      if (imp.pipeline_id && touchedIds.length) {
        const { data: removed } = await admin
          .from('pipeline_contacts')
          .delete()
          .eq('pipeline_id', imp.pipeline_id)
          .eq('source_id', importId)
          .in('contact_id', touchedIds)
          .select('id');
        unenrolled = removed?.length ?? 0;
      }

      let deleted = 0;
      for (let i = 0; i < createdIds.length; i += 200) {
        const chunk = createdIds.slice(i, i + 200);
        const { data: gone } = await admin.from('contacts').delete().in('id', chunk).select('id');
        deleted += gone?.length ?? 0;
      }

      // Remove the import tag from people who survived (updated / enrolled-only)
      if (imp.import_tag && touchedIds.length) {
        for (let i = 0; i < touchedIds.length; i += 200) {
          await admin
            .from('contact_tags')
            .delete()
            .eq('tag', imp.import_tag)
            .in('contact_id', touchedIds.slice(i, i + 200));
        }
      }

      await admin
        .from('contact_imports')
        .update({ status: 'undone', undone_at: new Date().toISOString() })
        .eq('id', importId);

      return json({ deleted, unenrolled });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('[contacts-csv-import] error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

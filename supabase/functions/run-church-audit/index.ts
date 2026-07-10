// Runs a Church Health Audit for the caller's organization.
// Body: { organizationId: string, reportId?: string }
// If reportId is provided we resume/refresh that report; otherwise create a new one.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

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
    const { organizationId } = body as { organizationId?: string };
    if (!organizationId) return json({ error: 'organizationId required' }, 400);

    // Membership check
    const { data: membership } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) return json({ error: 'Forbidden' }, 403);

    // Create report row
    const { data: report, error: reportErr } = await admin
      .from('church_health_reports')
      .insert({
        organization_id: organizationId,
        created_by_user_id: user.id,
        status: 'running',
      })
      .select('id')
      .single();
    if (reportErr || !report) throw reportErr || new Error('Failed to create report');

    const reportId = report.id;

    // Kick background analysis (don't await). Use EdgeRuntime.waitUntil when
    // available, otherwise fall back to fire-and-forget — never both, or the
    // analysis runs twice and duplicates findings.
    // deno-lint-ignore no-explicit-any
    const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
    if (typeof waitUntil === 'function') {
      waitUntil(runAnalysis(admin, reportId, organizationId));
    } else {
      runAnalysis(admin, reportId, organizationId).catch((e) => console.error('audit background error', e));
    }

    return json({ reportId }, 200);
  } catch (e) {
    console.error('run-church-audit error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// deno-lint-ignore no-explicit-any
async function runAnalysis(admin: any, reportId: string, orgId: string) {
  try {
    const nowIso = new Date().toISOString();
    const d60 = new Date(Date.now() - 60 * 86400_000).toISOString();
    const d45 = new Date(Date.now() - 45 * 86400_000).toISOString();
    const d90 = new Date(Date.now() - 90 * 86400_000).toISOString();

    // Fetch data (bounded)
    const [contactsRes, engagementRes, groupsRes, meetingsRes, membersRes, interactionsRes] = await Promise.all([
      admin.from('contacts').select('id, name, avatar, status, campus_id').eq('organization_id', orgId).eq('status', 'active').limit(5000),
      admin.from('contact_engagement_scores').select('contact_id, engagement_level, score, last_checkin_at, weeks_attended_last_12, total_checkins_30d, total_checkins_90d').eq('organization_id', orgId).limit(5000),
      admin.from('groups').select('id, name, status, capacity, member_count, leader_user_id, co_leader_user_id, image_url').eq('organization_id', orgId).eq('status', 'active').limit(2000),
      admin.from('group_meetings').select('id, group_id, meeting_date').gte('meeting_date', d90).limit(5000),
      admin.from('group_members').select('id, group_id, contact_id, role, status').eq('status', 'active').limit(10000),
      admin.from('contact_interactions').select('contact_id, created_at, created_by_user_id').gte('created_at', d60).limit(10000),
    ]);

    const contacts = contactsRes.data || [];
    const engagement = engagementRes.data || [];
    const groups = groupsRes.data || [];
    const meetings = meetingsRes.data || [];
    const members = membersRes.data || [];
    const interactions = interactionsRes.data || [];

    const contactIds = new Set(contacts.map((c: any) => c.id));
    const contactById = new Map(contacts.map((c: any) => [c.id, c]));

    const findings: Array<any> = [];
    const sectionScores: Record<string, number> = {};
    const metrics: Record<string, any> = {};

    // ── At-Risk / Drifting People
    {
      const engByContact = new Map(engagement.map((e: any) => [e.contact_id, e]));
      const interactionsByContact = new Map<string, string>();
      for (const i of interactions) {
        const prev = interactionsByContact.get(i.contact_id);
        if (!prev || new Date(i.created_at) > new Date(prev)) interactionsByContact.set(i.contact_id, i.created_at);
      }

      // No check-in in 60d among adults with prior engagement
      const noCheckinIds = contacts
        .filter((c: any) => {
          const e = engByContact.get(c.id) as any;
          if (!e) return false;
          if (!e.last_checkin_at) return false;
          return new Date(e.last_checkin_at).toISOString() < d60 && (e.weeks_attended_last_12 || 0) >= 4;
        })
        .map((c: any) => c.id);

      const drifting = engagement.filter((e: any) => e.engagement_level === 'drifting' && contactIds.has(e.contact_id)).map((e: any) => e.contact_id);
      const slowing = engagement.filter((e: any) => e.engagement_level === 'slowing' && contactIds.has(e.contact_id)).map((e: any) => e.contact_id);

      const noCareIds = contacts
        .filter((c: any) => !interactionsByContact.has(c.id))
        .map((c: any) => c.id)
        .slice(0, 500);

      findings.push({
        section: 'at_risk', key: 'no_checkin_60d',
        title: 'No check-in in the last 60 days',
        description: 'Previously regular attenders who have not checked in for 60+ days.',
        severity: 'high', metric_value: noCheckinIds.length, metric_label: 'people',
        contact_ids: noCheckinIds.slice(0, 500), sort_order: 1,
      });
      findings.push({
        section: 'at_risk', key: 'drifting',
        title: 'Currently marked as drifting',
        description: 'Contacts flagged by the engagement model as drifting away.',
        severity: 'high', metric_value: drifting.length, metric_label: 'people',
        contact_ids: drifting.slice(0, 500), sort_order: 2,
      });
      findings.push({
        section: 'at_risk', key: 'slowing',
        title: 'Engagement is slowing',
        description: 'People whose attendance rhythm dropped recently. Reach out before they drift.',
        severity: 'medium', metric_value: slowing.length, metric_label: 'people',
        contact_ids: slowing.slice(0, 500), sort_order: 3,
      });

      const totalAtRisk = new Set([...noCheckinIds, ...drifting, ...slowing]).size;
      metrics.at_risk = {
        total_at_risk: totalAtRisk,
        no_checkin_60d: noCheckinIds.length,
        drifting: drifting.length,
        slowing: slowing.length,
      };
      // Score: fewer at-risk % of active roster = higher score
      const pct = contacts.length > 0 ? totalAtRisk / contacts.length : 0;
      sectionScores.at_risk = Math.round(Math.max(0, Math.min(100, 100 - pct * 200)));
    }

    // ── Volunteer & Leader Health
    {
      const leaderRoleSet = new Set(['leader', 'co-leader', 'co_leader', 'host']);
      const leaderMembers = members.filter((m: any) => leaderRoleSet.has((m.role || '').toLowerCase()));
      const leaderContactIds = new Set(leaderMembers.map((m: any) => m.contact_id));

      // Workload by leader (# people they lead — count of group_members in groups they lead)
      const groupsByLeader = new Map<string, number>();
      for (const g of groups) {
        for (const uid of [g.leader_user_id, g.co_leader_user_id]) {
          if (uid) groupsByLeader.set(uid, (groupsByLeader.get(uid) || 0) + (g.member_count || 0));
        }
      }
      const overloaded = [...groupsByLeader.entries()].filter(([_, n]) => n > 30).length;

      // Leaders with no recent care (no interaction in 60d)
      const interactionsByContact = new Set(interactions.map((i: any) => i.contact_id));
      const leadersWithoutCare = [...leaderContactIds].filter((cid) => !interactionsByContact.has(cid));

      // Groups missing co-leader/host
      const groupsMissingBackup = groups.filter((g: any) => !g.co_leader_user_id);

      findings.push({
        section: 'volunteers', key: 'leaders_without_care',
        title: 'Leaders without recent care',
        description: 'Leaders and hosts who have not had a staff interaction in the last 60 days.',
        severity: 'high', metric_value: leadersWithoutCare.length, metric_label: 'leaders',
        contact_ids: leadersWithoutCare.slice(0, 500), sort_order: 1,
      });
      findings.push({
        section: 'volunteers', key: 'overloaded_leaders',
        title: 'Overloaded leaders',
        description: 'Leaders currently shepherding 30+ people across their groups.',
        severity: 'medium', metric_value: overloaded, metric_label: 'leaders',
        contact_ids: [], sort_order: 2,
      });
      findings.push({
        section: 'volunteers', key: 'groups_missing_backup',
        title: 'Groups without a co-leader',
        description: 'Groups running with a single leader and no back-up.',
        severity: 'medium', metric_value: groupsMissingBackup.length, metric_label: 'groups',
        contact_ids: [], sort_order: 3,
      });

      metrics.volunteers = {
        active_leaders: leaderContactIds.size,
        leaders_without_care: leadersWithoutCare.length,
        overloaded_leaders: overloaded,
        groups_missing_backup: groupsMissingBackup.length,
      };
      const leaderCount = leaderContactIds.size || 1;
      const careRate = 1 - leadersWithoutCare.length / leaderCount;
      sectionScores.volunteers = Math.round(Math.max(0, Math.min(100, careRate * 100)));
    }

    // ── Groups Health
    {
      const meetingsByGroup = new Map<string, string[]>();
      for (const m of meetings) {
        const arr = meetingsByGroup.get(m.group_id) || [];
        arr.push(m.meeting_date);
        meetingsByGroup.set(m.group_id, arr);
      }
      const dormant = groups.filter((g: any) => {
        const arr = meetingsByGroup.get(g.id) || [];
        return arr.every((d) => d < d45);
      });
      const overCap = groups.filter((g: any) => (g.capacity || 0) > 0 && (g.member_count || 0) > g.capacity);
      const noCoLeader = groups.filter((g: any) => !g.co_leader_user_id);

      findings.push({
        section: 'groups', key: 'dormant_groups',
        title: 'Dormant groups',
        description: 'Groups with no meeting in the last 45 days.',
        severity: 'high', metric_value: dormant.length, metric_label: 'groups',
        contact_ids: [], sort_order: 1,
      });
      findings.push({
        section: 'groups', key: 'over_capacity',
        title: 'Over-capacity groups',
        description: 'Groups whose membership exceeds their set capacity.',
        severity: 'medium', metric_value: overCap.length, metric_label: 'groups',
        contact_ids: [], sort_order: 2,
      });
      findings.push({
        section: 'groups', key: 'no_co_leader',
        title: 'Groups with no co-leader',
        description: 'Groups without a co-leader or back-up host.',
        severity: 'low', metric_value: noCoLeader.length, metric_label: 'groups',
        contact_ids: [], sort_order: 3,
      });

      metrics.groups = {
        total_groups: groups.length,
        dormant: dormant.length,
        over_capacity: overCap.length,
        no_co_leader: noCoLeader.length,
      };
      const activeRate = groups.length > 0 ? 1 - dormant.length / groups.length : 1;
      sectionScores.groups = Math.round(Math.max(0, Math.min(100, activeRate * 100)));
    }

    const overallScore = Math.round(
      (sectionScores.at_risk + sectionScores.volunteers + sectionScores.groups) / 3,
    );

    // Insert findings
    if (findings.length > 0) {
      const rows = findings.map((f) => ({ ...f, report_id: reportId }));
      const { error: fErr } = await admin.from('church_health_findings').insert(rows);
      if (fErr) throw fErr;
    }

    await admin
      .from('church_health_reports')
      .update({
        status: 'ready',
        overall_score: overallScore,
        section_scores: sectionScores,
        metrics,
        generated_at: nowIso,
      })
      .eq('id', reportId);
  } catch (e) {
    console.error('audit analysis failed', e);
    await admin
      .from('church_health_reports')
      .update({ status: 'failed', error: (e as Error).message })
      .eq('id', reportId);
  }
}

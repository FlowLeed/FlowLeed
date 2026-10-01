// Runs a Church Health Audit for the caller's organization.
// Body: { organizationId: string, reportId?: string }
// If reportId is provided we resume/refresh that report; otherwise create a new one.
import { createClient } from '@supabase/supabase-js';
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
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const d7 = new Date(now - 7 * 86400_000).toISOString();
    const d14 = new Date(now - 14 * 86400_000).toISOString();
    const d30 = new Date(now - 30 * 86400_000).toISOString();
    const d45 = new Date(now - 45 * 86400_000).toISOString();
    const d60 = new Date(now - 60 * 86400_000).toISOString();
    const d90 = new Date(now - 90 * 86400_000).toISOString();

    // Paginated fetch to avoid the default 1000-row Supabase cap.
    // deno-lint-ignore no-explicit-any
    async function fetchAll(build: () => any, pageSize = 1000): Promise<any[]> {
      const out: any[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await build().range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        out.push(...data);
        if (data.length < pageSize) break;
        if (out.length >= 100_000) break;
      }
      return out;
    }

    const [
      contacts, engagement, groups, meetings, members, interactions,
      checkins, prayers, pipelineContactsAll, signupRequestsAll, groupAttendanceAll,
    ] = await Promise.all([
      fetchAll(() => admin.from('contacts').select('id, name, avatar, status, campus_id, pc_household_id, created_at').eq('organization_id', orgId).eq('status', 'active')),
      fetchAll(() => admin.from('contact_engagement_scores').select('contact_id, engagement_level, score, last_checkin_at, weeks_attended_last_12, total_checkins_30d, total_checkins_90d').eq('organization_id', orgId)),
      fetchAll(() => admin.from('groups').select('id, name, status, capacity, member_count, leader_user_id, co_leader_user_id, image_url, created_at').eq('organization_id', orgId).eq('status', 'active')),
      fetchAll(() => admin.from('group_meetings').select('id, group_id, meeting_date').gte('meeting_date', d90)),
      fetchAll(() => admin.from('group_members').select('id, group_id, contact_id, role, status, created_at').eq('status', 'active')),
      fetchAll(() => admin.from('contact_interactions').select('contact_id, created_at, created_by_user_id').gte('created_at', d90)),
      fetchAll(() => admin.from('pco_checkins').select('contact_id, checked_in_at, event_name').eq('organization_id', orgId).gte('checked_in_at', d90)),
      fetchAll(() => admin.from('contact_prayer_requests').select('contact_id, created_at, status').eq('status', 'open').lte('created_at', d14)),
      fetchAll(() => admin.from('pipeline_contacts').select('contact_id, completed_end_at').is('completed_end_at', null)),
      fetchAll(() => admin.from('group_signup_requests').select('id, contact_id, group_id, created_at, status').eq('status', 'pending').lte('created_at', d7)),
      fetchAll(() => admin.from('group_attendance').select('contact_id, checked_in_at, status').gte('checked_in_at', d60)),
    ]);

    const contactIds = new Set(contacts.map((c: any) => c.id));
    // Filter cross-org tables down to this org's contacts
    const prayerOpen = prayers.filter((p: any) => contactIds.has(p.contact_id));
    const pipelineContacts = pipelineContactsAll.filter((p: any) => contactIds.has(p.contact_id));
    const signupRequests = signupRequestsAll.filter((r: any) => contactIds.has(r.contact_id));
    const groupAttendance = groupAttendanceAll.filter((a: any) => contactIds.has(a.contact_id) && a.status === 'present');

    const findings: Array<any> = [];
    const sectionScores: Record<string, number> = {};
    const metrics: Record<string, any> = {};

    // Interaction indexes (used across sections)
    const lastInteractionByContact = new Map<string, string>();
    for (const i of interactions) {
      const prev = lastInteractionByContact.get(i.contact_id);
      if (!prev || new Date(i.created_at) > new Date(prev)) lastInteractionByContact.set(i.contact_id, i.created_at);
    }
    const interactionsByContact = new Set(interactions.map((i: any) => i.contact_id));

    // First check-in per contact within fetched 90d window
    const firstCheckinByContact = new Map<string, string>();
    const checkinCountByContact = new Map<string, number>();
    for (const c of checkins) {
      if (!c.contact_id) continue;
      const prev = firstCheckinByContact.get(c.contact_id);
      if (!prev || new Date(c.checked_in_at) < new Date(prev)) firstCheckinByContact.set(c.contact_id, c.checked_in_at);
      checkinCountByContact.set(c.contact_id, (checkinCountByContact.get(c.contact_id) || 0) + 1);
    }

    // ── Guest & New Family Follow-up (new section)
    {
      // First-time guests in last 30d: contact whose earliest checkin in fetched window is within 30d
      // and whose contact record was created within last 60d (guards against re-appearing regulars).
      const firstTimeIds: string[] = [];
      for (const c of contacts) {
        const firstAt = firstCheckinByContact.get(c.id);
        if (!firstAt) continue;
        if (firstAt < d30) continue;
        // Contact newness guard — created in last 60d OR only 1 checkin ever seen
        const cnt = checkinCountByContact.get(c.id) || 0;
        const isNewRecord = c.created_at && c.created_at >= d60;
        if (isNewRecord || cnt <= 1) firstTimeIds.push(c.id);
      }

      // New families (households) — group first-timers (extended to 60d) by pc_household_id
      const householdsWithFirstTimer = new Set<string>();
      for (const c of contacts) {
        const firstAt = firstCheckinByContact.get(c.id);
        if (!firstAt || firstAt < d60) continue;
        if (c.pc_household_id) householdsWithFirstTimer.add(c.pc_household_id);
      }

      // Guests with no follow-up interaction since their first visit
      const guestsNoFollowup = firstTimeIds.filter((id) => {
        const firstAt = firstCheckinByContact.get(id)!;
        const lastInt = lastInteractionByContact.get(id);
        return !lastInt || new Date(lastInt) < new Date(firstAt);
      });

      // Second-time attenders (2+ checkins in last 60d) not enrolled in any active flow
      const flowContactIds = new Set(pipelineContacts.map((p: any) => p.contact_id));
      const secondTimeNoFlow: string[] = [];
      for (const c of contacts) {
        const cnt = checkinCountByContact.get(c.id) || 0;
        const firstAt = firstCheckinByContact.get(c.id);
        if (cnt < 2 || !firstAt || firstAt < d60) continue;
        if (!flowContactIds.has(c.id)) secondTimeNoFlow.push(c.id);
      }

      findings.push({
        section: 'guests', key: 'first_time_30d',
        title: 'First-time guests (last 30 days)',
        description: 'People whose first check-in in our records is within the last 30 days.',
        severity: 'low', metric_value: firstTimeIds.length, metric_label: 'people',
        contact_ids: firstTimeIds.slice(0, 500), sort_order: 1,
      });
      findings.push({
        section: 'guests', key: 'new_families_60d',
        title: 'New families (last 60 days)',
        description: 'Distinct households that had a first-time visitor in the last 60 days.',
        severity: 'low', metric_value: householdsWithFirstTimer.size, metric_label: 'households',
        contact_ids: [], sort_order: 2,
      });
      findings.push({
        section: 'guests', key: 'guests_no_followup',
        title: 'Guests with no follow-up',
        description: 'First-time guests from the last 30 days with zero staff interactions since their visit.',
        severity: 'high', metric_value: guestsNoFollowup.length, metric_label: 'people',
        contact_ids: guestsNoFollowup.slice(0, 500), sort_order: 3,
      });
      findings.push({
        section: 'guests', key: 'second_time_no_flow',
        title: 'Second-time attenders not in a flow',
        description: 'People with 2+ recent check-ins who are not enrolled in any active flow.',
        severity: 'medium', metric_value: secondTimeNoFlow.length, metric_label: 'people',
        contact_ids: secondTimeNoFlow.slice(0, 500), sort_order: 4,
      });

      metrics.guests = {
        first_time_30d: firstTimeIds.length,
        new_families_60d: householdsWithFirstTimer.size,
        guests_no_followup: guestsNoFollowup.length,
        second_time_no_flow: secondTimeNoFlow.length,
      };
      const followupRate = firstTimeIds.length > 0 ? 1 - guestsNoFollowup.length / firstTimeIds.length : 1;
      sectionScores.guests = Math.round(Math.max(0, Math.min(100, followupRate * 100)));
    }

    // ── At-Risk / Drifting People
    {
      const engByContact = new Map(engagement.map((e: any) => [e.contact_id, e]));

      const noCheckinIds = contacts
        .filter((c: any) => {
          const e = engByContact.get(c.id) as any;
          if (!e || !e.last_checkin_at) return false;
          return new Date(e.last_checkin_at).toISOString() < d60 && (e.weeks_attended_last_12 || 0) >= 4;
        })
        .map((c: any) => c.id);

      // Earlier warning: last check-in 30–60 days ago after a regular pattern
      const noCheckin30Ids = contacts
        .filter((c: any) => {
          const e = engByContact.get(c.id) as any;
          if (!e || !e.last_checkin_at) return false;
          const lc = new Date(e.last_checkin_at).toISOString();
          return lc < d30 && lc >= d60 && (e.weeks_attended_last_12 || 0) >= 4;
        })
        .map((c: any) => c.id);

      const drifting = engagement.filter((e: any) => (e.engagement_level === 'at_risk' || e.engagement_level === 'drifting') && contactIds.has(e.contact_id)).map((e: any) => e.contact_id);
      const slowing = engagement.filter((e: any) => (e.engagement_level === 'inactive' || e.engagement_level === 'slowing') && contactIds.has(e.contact_id) && (e.total_checkins_90d || 0) > 0).map((e: any) => e.contact_id);

      // Regulars whose small-group attendance stopped — active in checkins but no group attendance in 45d+
      const groupAttByContactMax = new Map<string, string>();
      for (const a of groupAttendance) {
        const prev = groupAttByContactMax.get(a.contact_id);
        if (!prev || new Date(a.checked_in_at) > new Date(prev)) groupAttByContactMax.set(a.contact_id, a.checked_in_at);
      }
      const groupDropoff = contacts
        .filter((c: any) => {
          const e = engByContact.get(c.id) as any;
          if (!e || (e.total_checkins_30d || 0) < 1) return false;
          const lastGroup = groupAttByContactMax.get(c.id);
          return !lastGroup || lastGroup < d45;
        })
        .map((c: any) => c.id);

      // Prayer requests older than 14 days with no follow-up interaction since
      const prayersNoFollowupIds = Array.from(new Set(
        prayerOpen
          .filter((p: any) => {
            const lastInt = lastInteractionByContact.get(p.contact_id);
            return !lastInt || new Date(lastInt) < new Date(p.created_at);
          })
          .map((p: any) => p.contact_id as string)
      ));

      findings.push({
        section: 'at_risk', key: 'no_checkin_60d',
        title: 'No check-in in the last 60 days',
        description: 'Previously regular attenders who have not checked in for 60+ days.',
        severity: 'high', metric_value: noCheckinIds.length, metric_label: 'people',
        contact_ids: noCheckinIds.slice(0, 500), sort_order: 1,
      });
      findings.push({
        section: 'at_risk', key: 'no_checkin_30d',
        title: 'No check-in in 30–60 days',
        description: 'Early-warning: previously regular attenders whose last check-in was 30–60 days ago.',
        severity: 'medium', metric_value: noCheckin30Ids.length, metric_label: 'people',
        contact_ids: noCheckin30Ids.slice(0, 500), sort_order: 2,
      });
      findings.push({
        section: 'at_risk', key: 'drifting',
        title: 'At-risk / drifting',
        description: 'Contacts flagged by the engagement model as at-risk of drifting away.',
        severity: 'high', metric_value: drifting.length, metric_label: 'people',
        contact_ids: drifting.slice(0, 500), sort_order: 3,
      });
      findings.push({
        section: 'at_risk', key: 'slowing',
        title: 'Engagement is slowing',
        description: 'People whose attendance rhythm dropped recently. Reach out before they drift.',
        severity: 'medium', metric_value: slowing.length, metric_label: 'people',
        contact_ids: slowing.slice(0, 500), sort_order: 4,
      });
      findings.push({
        section: 'at_risk', key: 'group_dropoff',
        title: 'Regulars whose group attendance stopped',
        description: 'People still attending on Sundays but with no group meeting attendance in 45+ days.',
        severity: 'medium', metric_value: groupDropoff.length, metric_label: 'people',
        contact_ids: groupDropoff.slice(0, 500), sort_order: 5,
      });
      findings.push({
        section: 'at_risk', key: 'prayers_no_followup',
        title: 'Prayer requests with no follow-up',
        description: 'Open prayer requests older than 14 days with no interaction since they were submitted.',
        severity: 'high', metric_value: prayersNoFollowupIds.length, metric_label: 'people',
        contact_ids: prayersNoFollowupIds.slice(0, 500), sort_order: 6,
      });

      const totalAtRisk = new Set([...noCheckinIds, ...drifting, ...slowing]).size;
      metrics.at_risk = {
        total_at_risk: totalAtRisk,
        no_checkin_60d: noCheckinIds.length,
        no_checkin_30d: noCheckin30Ids.length,
        drifting: drifting.length,
        slowing: slowing.length,
        group_dropoff: groupDropoff.length,
        prayers_no_followup: prayersNoFollowupIds.length,
      };
      const pct = contacts.length > 0 ? totalAtRisk / contacts.length : 0;
      sectionScores.at_risk = Math.round(Math.max(0, Math.min(100, 100 - pct * 200)));
    }

    // ── Volunteer & Leader Health
    {
      const leaderRoleSet = new Set(['leader', 'co-leader', 'co_leader', 'host']);
      const leaderMembers = members.filter((m: any) => leaderRoleSet.has((m.role || '').toLowerCase()));
      const leaderContactIds = new Set(leaderMembers.map((m: any) => m.contact_id));

      const groupsByLeader = new Map<string, number>();
      for (const g of groups) {
        for (const uid of [g.leader_user_id, g.co_leader_user_id]) {
          if (uid) groupsByLeader.set(uid, (groupsByLeader.get(uid) || 0) + (g.member_count || 0));
        }
      }
      const overloaded = [...groupsByLeader.entries()].filter(([_, n]) => n > 30).length;

      const leadersWithoutCare = [...leaderContactIds].filter((cid) => !interactionsByContact.has(cid as string));

      // Leaders whose own engagement is dropping
      const engByContact = new Map(engagement.map((e: any) => [e.contact_id, e]));
      const leadersEngagementDropping = [...leaderContactIds].filter((cid) => {
        const e = engByContact.get(cid as string) as any;
        return e && (e.engagement_level === 'at_risk' || e.engagement_level === 'drifting' || e.engagement_level === 'inactive' || e.engagement_level === 'slowing');
      });

      // New leaders in last 90 days
      const newLeaderMembers = leaderMembers.filter((m: any) => m.created_at && m.created_at >= d90);
      const newLeaderContactIds = Array.from(new Set(newLeaderMembers.map((m: any) => m.contact_id as string)));

      findings.push({
        section: 'volunteers', key: 'leaders_without_care',
        title: 'Leaders without recent care',
        description: 'Leaders and hosts who have not had a staff interaction in the last 90 days.',
        severity: 'high', metric_value: leadersWithoutCare.length, metric_label: 'leaders',
        contact_ids: leadersWithoutCare.slice(0, 500) as string[], sort_order: 1,
      });
      findings.push({
        section: 'volunteers', key: 'leaders_engagement_dropping',
        title: 'Leaders whose engagement is dropping',
        description: 'Leaders and hosts whose own attendance engagement is now at-risk or slowing.',
        severity: 'high', metric_value: leadersEngagementDropping.length, metric_label: 'leaders',
        contact_ids: leadersEngagementDropping.slice(0, 500) as string[], sort_order: 2,
      });
      findings.push({
        section: 'volunteers', key: 'overloaded_leaders',
        title: 'Overloaded leaders',
        description: 'Leaders currently shepherding 30+ people across their groups.',
        severity: 'medium', metric_value: overloaded, metric_label: 'leaders',
        contact_ids: [], sort_order: 3,
      });
      findings.push({
        section: 'volunteers', key: 'new_leaders_90d',
        title: 'New leaders in the last 90 days',
        description: 'Recently activated leaders — celebrate them and focus onboarding care.',
        severity: 'low', metric_value: newLeaderContactIds.length, metric_label: 'leaders',
        contact_ids: newLeaderContactIds.slice(0, 500), sort_order: 4,
      });

      metrics.volunteers = {
        active_leaders: leaderContactIds.size,
        leaders_without_care: leadersWithoutCare.length,
        leaders_engagement_dropping: leadersEngagementDropping.length,
        overloaded_leaders: overloaded,
        new_leaders_90d: newLeaderContactIds.length,
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

      // Attendance rows per meeting → avg attendees per meeting per group (last 30d vs 30-60d)
      const attByMeeting = new Map<string, number>();
      for (const a of groupAttendance) {
        // group_attendance was filtered above but we don't have group_id — recompute using meetings map
      }
      // Build meeting_id → group_id
      const meetingToGroup = new Map<string, string>();
      const meetingDate = new Map<string, string>();
      for (const m of meetings) { meetingToGroup.set(m.id, m.group_id); meetingDate.set(m.id, m.meeting_date); }
      // Re-fetch group_attendance with meeting id? We fetched without group_meeting_id in projection — augment
      // (already selected in query above? no, we removed it). Simpler: recount attendance by meeting_date using groupAttendance rows joined on group_id via contact→member map.
      const memberContactToGroups = new Map<string, string[]>();
      for (const m of members) {
        const arr = memberContactToGroups.get(m.contact_id) || [];
        arr.push(m.group_id);
        memberContactToGroups.set(m.contact_id, arr);
      }
      // For each attendance row, attribute to first matching group of that contact
      const groupAttRecent: Map<string, number> = new Map();
      const groupAttPrior: Map<string, number> = new Map();
      for (const a of groupAttendance) {
        const gs = memberContactToGroups.get(a.contact_id) || [];
        for (const g of gs) {
          if (a.checked_in_at >= d30) groupAttRecent.set(g, (groupAttRecent.get(g) || 0) + 1);
          else groupAttPrior.set(g, (groupAttPrior.get(g) || 0) + 1);
        }
      }
      const declining = groups.filter((g: any) => {
        const r = groupAttRecent.get(g.id) || 0;
        const p = groupAttPrior.get(g.id) || 0;
        return p >= 6 && r < p * 0.7;
      });

      // Groups with no new members in 90 days
      const latestMemberByGroup = new Map<string, string>();
      for (const m of members) {
        if (!m.created_at) continue;
        const prev = latestMemberByGroup.get(m.group_id);
        if (!prev || m.created_at > prev) latestMemberByGroup.set(m.group_id, m.created_at);
      }
      const noNewMembers = groups.filter((g: any) => {
        const latest = latestMemberByGroup.get(g.id);
        return !latest || latest < d90;
      });

      // Pending signup requests older than 7 days
      const pendingSignupGroupIds = new Set(signupRequests.map((r: any) => r.group_id));

      findings.push({
        section: 'groups', key: 'dormant_groups',
        title: 'Dormant groups',
        description: 'Groups with no meeting in the last 45 days.',
        severity: 'high', metric_value: dormant.length, metric_label: 'groups',
        contact_ids: [], sort_order: 1,
      });
      findings.push({
        section: 'groups', key: 'declining_attendance',
        title: 'Groups with declining attendance',
        description: 'Groups whose attendance in the last 30 days is 30%+ below the prior 30 days.',
        severity: 'medium', metric_value: declining.length, metric_label: 'groups',
        contact_ids: [], sort_order: 2,
      });
      findings.push({
        section: 'groups', key: 'over_capacity',
        title: 'Over-capacity groups',
        description: 'Groups whose membership exceeds their set capacity.',
        severity: 'medium', metric_value: overCap.length, metric_label: 'groups',
        contact_ids: [], sort_order: 3,
      });
      findings.push({
        section: 'groups', key: 'no_new_members_90d',
        title: 'Groups with no new members in 90 days',
        description: 'Groups that have not added a member in the last 90 days — signals stagnation.',
        severity: 'low', metric_value: noNewMembers.length, metric_label: 'groups',
        contact_ids: [], sort_order: 4,
      });
      findings.push({
        section: 'groups', key: 'pending_signups',
        title: 'Pending group signup requests',
        description: 'Signup requests older than 7 days that are still pending leader response.',
        severity: 'medium', metric_value: signupRequests.length, metric_label: 'requests',
        contact_ids: [], sort_order: 5,
      });
      findings.push({
        section: 'groups', key: 'no_co_leader',
        title: 'Groups with no co-leader',
        description: 'Groups without a co-leader or back-up host.',
        severity: 'low', metric_value: noCoLeader.length, metric_label: 'groups',
        contact_ids: [], sort_order: 6,
      });

      metrics.groups = {
        total_groups: groups.length,
        dormant: dormant.length,
        declining_attendance: declining.length,
        over_capacity: overCap.length,
        no_new_members_90d: noNewMembers.length,
        pending_signups: signupRequests.length,
        no_co_leader: noCoLeader.length,
      };
      const activeRate = groups.length > 0 ? 1 - dormant.length / groups.length : 1;
      sectionScores.groups = Math.round(Math.max(0, Math.min(100, activeRate * 100)));
    }

    const overallScore = Math.round(
      (sectionScores.guests + sectionScores.at_risk + sectionScores.volunteers + sectionScores.groups) / 4,
    );

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


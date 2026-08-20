// Seeds a fictional "sample church" into an organization so a new user can explore
// FlowLeed before connecting Planning Center or importing anything.
// Everything created here is flagged is_demo = true and removed by demo-data-clear.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

// Fictional people. Emails/phones are non-routable on purpose.
const PEOPLE: { first: string; last: string }[] = [
  { first: 'Marcus', last: 'Whitfield' }, { first: 'Tanya', last: 'Whitfield' },
  { first: 'Devon', last: 'Alcaraz' }, { first: 'Priya', last: 'Raman' },
  { first: 'Caleb', last: 'Stroud' }, { first: 'Hannah', last: 'Stroud' },
  { first: 'Ruben', last: 'Ortega' }, { first: 'Lena', last: 'Ortega' },
  { first: 'Josiah', last: 'Kemp' }, { first: 'Amara', last: 'Boateng' },
  { first: 'Nate', last: 'Sorensen' }, { first: 'Bethany', last: 'Sorensen' },
  { first: 'Ivan', last: 'Petrenko' }, { first: 'Sofia', last: 'Petrenko' },
  { first: 'Grant', last: 'Mullins' }, { first: 'Deborah', last: 'Ilesanmi' },
  { first: 'Trevor', last: 'Lindqvist' }, { first: 'Cassie', last: 'Nakamura' },
  { first: 'Omar', last: 'Haddad' }, { first: 'Renee', last: 'Haddad' },
  { first: 'Silas', last: 'Beaumont' }, { first: 'Mariela', last: 'Cortez' },
  { first: 'Jonah', last: 'Redfern' }, { first: 'Kirsten', last: 'Redfern' },
  { first: 'Andre', last: 'Villalobos' }, { first: 'Tessa', last: 'Kowalski' },
  { first: 'Emmett', last: 'Larkin' }, { first: 'Noelle', last: 'Ferreira' },
  { first: 'Damon', last: 'Achebe' }, { first: 'Willa', last: 'Thorne' },
];

const FLOWS = [
  {
    key: 'guest',
    name: 'Guest Follow-Up (Sample)',
    icon: 'UserPlus',
    description: 'First-time guests from the weekend, through a personal follow-up.',
    stages: ['New Guest', 'Reached Out', 'Conversation Had', 'Connected'],
  },
  {
    key: 'care',
    name: 'Pastoral Care (Sample)',
    icon: 'HeartHandshake',
    description: 'People walking through a hard season who need pastoral attention.',
    stages: ['New Request', 'Connected', 'Care Plan', 'Follow-Up', 'Resolved'],
  },
  {
    key: 'baptism',
    name: 'Baptism (Sample)',
    icon: 'Droplets',
    description: 'Baptism candidates from decision to celebration.',
    stages: ['Interested', 'Class Scheduled', 'Date Set', 'Baptized'],
  },
  {
    key: 'givers',
    name: 'First Time Givers (Sample)',
    icon: 'Gift',
    description: 'Thank and disciple people who just gave for the first time.',
    stages: ['First Gift', 'Thank You Sent', 'Invited to Next Step', 'Generous Partner'],
  },
];

// Categories must match the flow_moment_types_category_check constraint:
// salvation | next_step | serving | group | other
const MOMENT_TYPES = [
  { name: 'First Visit', category: 'next_step', icon: 'DoorOpen', color: '#3B82F6', weight: 20 },
  { name: 'Salvation', category: 'salvation', icon: 'Sparkles', color: '#F59E0B', weight: 40 },
  { name: 'Baptism Scheduled', category: 'next_step', icon: 'Droplets', color: '#06B6D4', weight: 30 },
  { name: 'First Gift', category: 'other', icon: 'Gift', color: '#10B981', weight: 25 },
  { name: 'Joined a Group', category: 'group', icon: 'Users', color: '#8B5CF6', weight: 25 },
  { name: 'Missed 3 Weeks', category: 'other', icon: 'AlertTriangle', color: '#EF4444', weight: 15 },
];


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let currentStep = 'setup';
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

    const { data: membership } = await admin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership?.organization_id) return json({ error: 'No organization' }, 403);
    const orgId = membership.organization_id as string;

    // Idempotent: never seed twice.
    const { count: existingDemo } = await admin
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_demo', true);

    if ((existingDemo ?? 0) > 0) {
      return json({ ok: true, alreadySeeded: true, contacts: existingDemo });
    }

    currentStep = 'moment types';
    // ---- Moment types -------------------------------------------------------
    const momentTypeIds: Record<string, string> = {};
    for (const mt of MOMENT_TYPES) {
      const { data: existing } = await admin
        .from('flow_moment_types')
        .select('id')
        .eq('organization_id', orgId)
        .eq('name', mt.name)
        .maybeSingle();
      if (existing?.id) {
        momentTypeIds[mt.name] = existing.id;
        continue;
      }
      const { data: created, error } = await admin
        .from('flow_moment_types')
        .insert({ organization_id: orgId, ...mt })
        .select('id')
        .single();
      if (error) throw error;
      momentTypeIds[mt.name] = created.id;
    }

    currentStep = 'contacts';

    // ---- Contacts -----------------------------------------------------------
    const contactRows = PEOPLE.map((p, i) => ({
      organization_id: orgId,
      name: `${p.first} ${p.last}`,
      email: `${p.first.toLowerCase()}.${p.last.toLowerCase()}@sample-church.example`,
      phone: `555010${String(1000 + i).slice(-4)}`,
      status: 'active',
      source_type: 'demo',
      is_demo: true,
      notes: null,
      created_at: daysAgo(120 - i * 3),
    }));

    const { data: contacts, error: contactErr } = await admin
      .from('contacts')
      .insert(contactRows)
      .select('id, name');
    if (contactErr) throw contactErr;

    const byName = new Map(contacts!.map((c) => [c.name, c.id]));
    const id = (i: number) => byName.get(`${PEOPLE[i].first} ${PEOPLE[i].last}`)!;

    // Team members of this org become fictional "assigned leaders".
    const { data: orgMembers } = await admin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId);
    const leaderIds = (orgMembers ?? []).map((m) => m.user_id as string);
    const leader = (i: number) => (leaderIds.length ? leaderIds[i % leaderIds.length] : null);

    currentStep = 'flows and stages';
    // ---- Flows + stages -----------------------------------------------------
    const flowIds: Record<string, string> = {};
    const stageIds: Record<string, string[]> = {};

    for (let f = 0; f < FLOWS.length; f++) {
      const flow = FLOWS[f];
      const { data: created, error } = await admin
        .from('pipelines')
        .insert({
          organization_id: orgId,
          name: flow.name,
          icon: flow.icon,
          description: flow.description,
          flow_order: 100 + f,
          is_demo: true,
        })
        .select('id')
        .single();
      if (error) throw error;
      flowIds[flow.key] = created.id;

      const stageRows = flow.stages.map((name, idx) => ({
        pipeline_id: created.id,
        name,
        stage_order: idx,
        is_start_step: idx === 0,
        is_end_step: idx === flow.stages.length - 1,
        default_assignee_user_id: leader(idx),
      }));
      const { data: stages, error: stageErr } = await admin
        .from('pipeline_stages')
        .insert(stageRows)
        .select('id, stage_order');
      if (stageErr) throw stageErr;
      stageIds[flow.key] = stages!
        .sort((a, b) => a.stage_order - b.stage_order)
        .map((s) => s.id);

      // Make sure current org members can see the demo flows.
      if (leaderIds.length) {
        await admin.from('pipeline_team_members').insert(
          leaderIds.map((uid, idx) => ({
            pipeline_id: created.id,
            user_id: uid,
            role: idx === 0 ? 'lead' : 'member',
          })),
        );
      }
    }

    currentStep = 'enrollments';
    // ---- Enrollments --------------------------------------------------------
    type Enrollment = { flow: string; person: number; stage: number; days: number };
    const enrollments: Enrollment[] = [
      // 10 new guests
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((p, i) => ({
        flow: 'guest', person: p, stage: i % 4, days: 3 + i * 2,
      })),
      // 10 in pastoral care
      ...[10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((p, i) => ({
        flow: 'care', person: p, stage: i % 5, days: 5 + i * 3,
      })),
      // 2 baptism candidates
      { flow: 'baptism', person: 20, stage: 1, days: 9 },
      { flow: 'baptism', person: 21, stage: 2, days: 4 },
      // 5 first time givers
      ...[22, 23, 24, 25, 26].map((p, i) => ({
        flow: 'givers', person: p, stage: i % 4, days: 6 + i * 4,
      })),
    ];

    const enrollmentRows = enrollments.map((e, i) => ({
      pipeline_id: flowIds[e.flow],
      stage_id: stageIds[e.flow][e.stage],
      contact_id: id(e.person),
      stage_order: i,
      source_type: 'demo',
      entered_start_at: daysAgo(e.days + 5),
      stage_entered_at: daysAgo(e.days),
      assigned_to_user_id: leader(i),
      created_at: daysAgo(e.days + 5),
    }));
    const { error: enrollErr } = await admin.from('pipeline_contacts').insert(enrollmentRows);
    if (enrollErr) throw enrollErr;

    currentStep = 'groups';

    // ---- Groups -------------------------------------------------------------
    const GROUPS = [
      {
        name: "Tuesday Men's Group (Sample)", group_type: 'small_group',
        meeting_day: 'tuesday', meeting_time: '19:00', location: 'Whitfield home',
        members: [0, 4, 6, 8, 10, 12],
      },
      {
        name: 'Young Adults (Sample)', group_type: 'small_group',
        meeting_day: 'thursday', meeting_time: '19:30', location: 'Room 202',
        members: [3, 9, 17, 21, 25, 27, 29],
      },
      {
        name: 'Sunday Serve Team (Sample)', group_type: 'serve_team',
        meeting_day: 'sunday', meeting_time: '08:00', location: 'Main Lobby',
        members: [1, 5, 7, 11, 15, 19],
      },
    ];

    for (let g = 0; g < GROUPS.length; g++) {
      const grp = GROUPS[g];
      const { data: created, error } = await admin
        .from('groups')
        .insert({
          organization_id: orgId,
          name: grp.name,
          group_type: grp.group_type,
          description: 'Sample group so you can see how Groups work.',
          meeting_day: grp.meeting_day,
          meeting_time: grp.meeting_time,
          meeting_frequency: 'weekly',
          location: grp.location,
          capacity: 12,
          leader_user_id: leader(g),
          status: 'active',
          visibility: 'private',
          member_count: grp.members.length,
          last_meeting_at: daysAgo(3 + g),
          is_demo: true,
        })
        .select('id')
        .single();
      if (error) throw error;

      const { data: members, error: memberErr } = await admin
        .from('group_members')
        .insert(
          grp.members.map((p, i) => ({
            group_id: created.id,
            contact_id: id(p),
            role: i === 0 ? 'leader' : 'member',
            status: 'active',
            joined_at: daysAgo(60 - i * 5),
            last_attended_at: daysAgo(3 + g),
            attendance_count: 6 - (i % 4),
          })),
        )
        .select('id, contact_id');
      if (memberErr) throw memberErr;

      // Three past meetings with attendance.
      for (let m = 0; m < 3; m++) {
        const { data: meeting, error: meetingErr } = await admin
          .from('group_meetings')
          .insert({
            group_id: created.id,
            title: `${grp.name} — Week ${3 - m}`,
            meeting_date: daysAgo(3 + g + m * 7),
            duration_minutes: 90,
            location: grp.location,
            status: 'completed',
            attendance_submitted: true,
          })
          .select('id')
          .single();
        if (meetingErr) throw meetingErr;

        await admin.from('group_attendance').insert(
          members!.map((mem, i) => ({
            group_meeting_id: meeting.id,
            group_member_id: mem.id,
            contact_id: mem.contact_id,
            status: (i + m) % 4 === 0 ? 'absent' : 'present',
            checked_in_at: daysAgo(3 + g + m * 7),
          })),
        );
      }
    }

    currentStep = 'flow moments';
    // ---- Flow moments -------------------------------------------------------
    const moments: { person: number; type: string; days: number }[] = [
      { person: 0, type: 'First Visit', days: 21 },
      { person: 1, type: 'First Visit', days: 21 },
      { person: 2, type: 'First Visit', days: 14 },
      { person: 3, type: 'First Visit', days: 10 },
      { person: 4, type: 'First Visit', days: 7 },
      { person: 20, type: 'Salvation', days: 24 },
      { person: 20, type: 'Baptism Scheduled', days: 9 },
      { person: 21, type: 'Salvation', days: 18 },
      { person: 21, type: 'Baptism Scheduled', days: 4 },
      { person: 22, type: 'First Gift', days: 12 },
      { person: 23, type: 'First Gift', days: 9 },
      { person: 24, type: 'First Gift', days: 6 },
      { person: 25, type: 'First Gift', days: 5 },
      { person: 26, type: 'First Gift', days: 2 },
      { person: 3, type: 'Joined a Group', days: 8 },
      { person: 9, type: 'Joined a Group', days: 15 },
      { person: 27, type: 'Joined a Group', days: 30 },
      { person: 12, type: 'Missed 3 Weeks', days: 2 },
      { person: 16, type: 'Missed 3 Weeks', days: 4 },
      { person: 28, type: 'Missed 3 Weeks', days: 1 },
    ];
    await admin.from('flow_moments').insert(
      moments.map((m) => ({
        contact_id: id(m.person),
        flow_moment_type_id: momentTypeIds[m.type],
        source_system: 'manual',
        source_reference: 'demo',
        occurred_at: daysAgo(m.days),
        metadata: { demo: true },
      })),
    );

    currentStep = 'engagement scores';
    // ---- Engagement scores (drives signals) --------------------------------
    const engagement = contacts!.map((c, i) => {
      const bucket = i % 10;
      const level = bucket < 5 ? 'active' : bucket < 8 ? 'at_risk' : 'dormant';
      const lastCheckin = level === 'active' ? 4 + (i % 5) : level === 'at_risk' ? 28 + i : 120 + i;
      return {
        contact_id: c.id,
        organization_id: orgId,
        engagement_level: level,
        total_checkins_90d: level === 'active' ? 9 - (i % 4) : level === 'at_risk' ? 2 : 0,
        total_checkins_30d: level === 'active' ? 3 : 0,
        weeks_attended_last_12: level === 'active' ? 9 : level === 'at_risk' ? 3 : 0,
        streak_weeks: level === 'active' ? 3 : 0,
        volunteer_checkins_90d: i % 5 === 0 ? 4 : 0,
        score: level === 'active' ? 78 - (i % 10) : level === 'at_risk' ? 42 : 12,
        last_checkin_at: daysAgo(lastCheckin),
      };
    });
    await admin.from('contact_engagement_scores').upsert(engagement, { onConflict: 'contact_id' });

    currentStep = 'activity';
    // ---- Interactions, notes and upcoming tasks -----------------------------
    const interactions = [
      { person: 0, type: 'call', subject: 'Welcome call after first visit', days: 18 },
      { person: 2, type: 'note', subject: 'Sent a handwritten card', days: 12 },
      { person: 10, type: 'call', subject: 'Prayer for hospital visit', days: 9 },
      { person: 14, type: 'meeting', subject: 'Coffee with Pastor', days: 6 },
      { person: 22, type: 'email', subject: 'Thank you for your first gift', days: 8 },
    ];
    await admin.from('contact_interactions').insert(
      interactions.map((it) => ({
        contact_id: id(it.person),
        interaction_type: it.type,
        subject: it.subject,
        details: 'Sample activity so the timeline is not empty.',
        completed_at: daysAgo(it.days),
        created_by_user_id: user.id,
        created_at: daysAgo(it.days),
        metadata: { demo: true },
      })),
    );

    await admin.from('contact_interactions').insert([
      {
        contact_id: id(21), interaction_type: 'task',
        subject: 'Confirm baptism date with Mariela', scheduled_at: daysAhead(2),
        created_by_user_id: user.id, assigned_to_user_id: user.id, metadata: { demo: true },
      },
      {
        contact_id: id(6), interaction_type: 'task',
        subject: 'Follow up with the Ortegas about serving', scheduled_at: daysAhead(4),
        created_by_user_id: user.id, assigned_to_user_id: user.id, metadata: { demo: true },
      },
    ]);

    await admin.from('contact_notes').insert([
      { contact_id: id(10), content: 'Family is walking through a job loss. Checking in weekly.', created_by_user_id: user.id, note_type: 'care' },
      { contact_id: id(12), content: 'Has not attended in over a month — worth a personal call.', created_by_user_id: user.id, note_type: 'general' },
      { contact_id: id(0), content: 'First-time guest, sat with the Stroud family.', created_by_user_id: user.id, note_type: 'general' },
    ]);

    currentStep = 'AI recommendations';
    // ---- Sample AI recommendations -----------------------------------------
    await admin.from('signal_agent_suggestions').insert([
      {
        organization_id: orgId, contact_id: id(12), signal_key: 'attendance_drop',
        signal_source: 'builtin', action_type: 'assign_follow_up',
        action_payload: { demo: true, suggested_channel: 'call' },
        reasoning: 'Ivan attended 9 of the last 12 weeks but has now missed 3 in a row. A quick personal call usually re-engages people at this stage.',
        confidence: 0.86, assignee_user_id: user.id,
      },
      {
        organization_id: orgId, contact_id: id(2), signal_key: 'guest_no_followup',
        signal_source: 'builtin', action_type: 'assign_follow_up',
        action_payload: { demo: true, suggested_channel: 'text' },
        reasoning: 'Devon visited 14 days ago and is still in "New Guest" with no contact logged. Guests contacted inside 48 hours are far more likely to return.',
        confidence: 0.91, assignee_user_id: user.id,
      },
      {
        organization_id: orgId, contact_id: id(21), signal_key: 'baptism_date_missing',
        signal_source: 'builtin', action_type: 'create_task',
        action_payload: { demo: true, task: 'Set a baptism date' },
        reasoning: 'Mariela finished the baptism class but has no date set. Locking in a date keeps the momentum from her decision.',
        confidence: 0.78, assignee_user_id: user.id,
      },
      {
        organization_id: orgId, contact_id: id(26), signal_key: 'first_gift_no_thanks',
        signal_source: 'builtin', action_type: 'send_message',
        action_payload: { demo: true, suggested_channel: 'email' },
        reasoning: 'Tessa gave for the first time 2 days ago and has not been thanked yet. A personal thank-you doubles the odds of a second gift.',
        confidence: 0.83, assignee_user_id: user.id,
      },
    ]);

    await admin
      .from('organizations')
      .update({ demo_seeded_at: new Date().toISOString(), demo_cleared_at: null })
      .eq('id', orgId);

    return json({
      ok: true,
      contacts: contacts!.length,
      flows: FLOWS.length,
      groups: GROUPS.length,
      enrollments: enrollmentRows.length,
    });
  } catch (e) {
    console.error('[demo-data-seed]', e);
    const err = e as { message?: string; details?: string; hint?: string };
    const detail = [err.message, err.details, err.hint].filter(Boolean).join(' — ');
    return json({ error: `Sample data failed while creating ${currentStep}: ${detail}` }, 500);
  }
});

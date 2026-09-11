// Evaluate custom signals for an org: match contacts against rules and
// upsert results into custom_signal_contacts (setting cleared_at when a
// contact no longer matches).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface Condition {
  source: string;
  operator: string;
  value: any;
  condition_group?: number;
}

export type WindowCountMap = Map<number, number>;

export type ContactFacts = {
  contact_id: string;
  campus_id: string | null;
  // Attendance
  last_service_days_ago: number | null;
  services_last_12w: number;
  lifetime_checkins: number;
  never_attended: boolean;
  is_first_time_guest: boolean;
  checkins_in_days: WindowCountMap;
  distinct_weeks_in_window: WindowCountMap;
  guest_checkins_in_days: WindowCountMap;
  household_checkins_in_days: WindowCountMap;
  weeks_last_12: number;
  weeks_prior_12: number;
  // Groups
  is_in_group: boolean;
  group_attendance_rate: number | null;
  group_meetings_count: number;
  last_group_attended_days_ago: number | null;
  never_attended_group: boolean;
  // Serving
  days_since_last_serve: number | null;
  never_served: boolean;
  volunteer_checkins_in_days: WindowCountMap;
  // Flows
  in_any_flow: boolean;
  active_flow_ids: Set<string>;
  active_stage_ids: Set<string>;
  days_in_stage: number | null;
  // Moments
  moment_days_by_type: Map<string, number>;
  any_moment_recent_in_days: WindowCountMap;
  has_salvation: boolean;
  // Church Online
  online_watched_in_days: WindowCountMap;
  online_prayer_in_days: WindowCountMap;
  // Tags
  tags: Set<string>;
};

function daysBetween(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function startOfWeekIso(iso: string): string {
  // Match PostgreSQL date_trunc('week', ...) which uses ISO-8601 Monday weeks.
  const d = new Date(iso);
  const day = d.getDay() || 7; // Sunday=7, Monday=1, ... Saturday=6
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function getWindowCount(m: WindowCountMap, days: number): number | null {
  return m.has(days) ? m.get(days)! : null;
}

function extractWindowDays(conditions: Condition[]): number[] {
  const days = new Set<number>();
  const windowSources = new Set([
    "attendance.checkins_in_days",
    "attendance.distinct_weeks_in_window",
    "attendance.guest_checkins_in_days",
    "attendance.household_checkins_in_days",
    "serve.checkins_in_days",
    "moment.any_recent_in_days",
    "online.watched_recent_in_days",
    "online.prayer_recent_in_days",
  ]);
  for (const c of conditions) {
    if (!windowSources.has(c.source)) continue;
    const v = windowCountValue(c.value);
    if (v.days > 0) days.add(v.days);
  }
  return Array.from(days).sort((a, b) => a - b);
}

function cmp(a: number | null, op: string, b: number): boolean {
  if (a === null) return false;
  switch (op) {
    case "eq":
      return a === b;
    case "gte":
      return a >= b;
    case "lte":
      return a <= b;
    case "gt":
      return a > b;
    case "lt":
      return a < b;
    default:
      return false;
  }
}

function windowCountValue(value: any): { days: number; count: number } {
  if (typeof value === "object" && value !== null) {
    return {
      days: Number(value.days) || 0,
      count: Number(value.count) || 0,
    };
  }
  return { days: 0, count: Number(value) || 0 };
}

function evalCond(c: Condition, f: ContactFacts): boolean {
  switch (c.source) {
    case "campus.assignment":
      if (c.operator === "unassigned") return f.campus_id === null;
      if (c.operator === "neq") return f.campus_id !== null && f.campus_id !== String(c.value || "");
      return f.campus_id === String(c.value || "");

    case "attendance.last_service_days_ago":
      return cmp(f.last_service_days_ago, c.operator, Number(c.value));

    case "attendance.never_attended":
      return f.never_attended;

    case "attendance.checkins_in_days": {
      const v = windowCountValue(c.value);
      return cmp(getWindowCount(f.checkins_in_days, v.days), c.operator, v.count);
    }

    case "attendance.distinct_weeks_in_window": {
      const v = windowCountValue(c.value);
      return cmp(getWindowCount(f.distinct_weeks_in_window, v.days), c.operator, v.count);
    }

    case "attendance.lifetime_checkins":
      return cmp(f.lifetime_checkins, c.operator, Number(c.value));

    case "attendance.guest_checkins_in_days": {
      const v = windowCountValue(c.value);
      return cmp(getWindowCount(f.guest_checkins_in_days, v.days), c.operator, v.count);
    }

    case "attendance.household_checkins_in_days": {
      const v = windowCountValue(c.value);
      return cmp(getWindowCount(f.household_checkins_in_days, v.days), c.operator, v.count);
    }

    case "attendance.weeks_last_12":
      return cmp(f.weeks_last_12, c.operator, Number(c.value));

    case "attendance.weeks_prior_12":
      return cmp(f.weeks_prior_12, c.operator, Number(c.value));

    case "attendance.weeks_last_12_ratio_to_prior": {
      if (f.weeks_prior_12 === 0) return false;
      const ratio = Math.round((f.weeks_last_12 * 100) / f.weeks_prior_12);
      return cmp(ratio, c.operator, Number(c.value));
    }

    // Backward-compatible aliases
    case "attendance.services_last_n_weeks":
      return cmp(f.services_last_12w, c.operator, Number(c.value));

    case "attendance.is_first_time_guest":
      return f.is_first_time_guest;

    case "group.is_in_group":
      return c.operator === "true" ? f.is_in_group : !f.is_in_group;

    case "group.never_attended":
      return f.never_attended_group;

    case "group.last_attended_days_ago":
      return cmp(f.last_group_attended_days_ago, c.operator, Number(c.value));

    case "group.meetings_count":
      return cmp(f.group_meetings_count, c.operator, Number(c.value));

    case "group.attendance_rate": {
      if (f.group_attendance_rate === null) return false;
      return cmp(f.group_attendance_rate, c.operator, Number(c.value));
    }

    case "serve.days_since_last":
      return cmp(f.days_since_last_serve, c.operator, Number(c.value));

    case "serve.never_served":
      return f.never_served;

    case "serve.checkins_in_days": {
      const v = windowCountValue(c.value);
      return cmp(getWindowCount(f.volunteer_checkins_in_days, v.days), c.operator, v.count);
    }

    case "flow.in_any_flow":
      return c.operator === "true" ? f.in_any_flow : !f.in_any_flow;

    case "flow.in_flow": {
      const hasFlow = f.active_flow_ids.has(String(c.value || ""));
      return c.operator === "neq" ? !hasFlow : hasFlow;
    }

    case "flow.in_stage":
      return f.active_stage_ids.has(String(c.value || ""));

    case "flow.days_in_stage":
      return cmp(f.days_in_stage, c.operator, Number(c.value));

    case "tag.has":
      return f.tags.has(String(c.value || "").toLowerCase());

    case "tag.not_has":
      return !f.tags.has(String(c.value || "").toLowerCase());

    case "moment.has_type": {
      const hasMoment = f.moment_days_by_type.has(String(c.value || ""));
      return c.operator === "not_has" ? !hasMoment : hasMoment;
    }

    case "moment.days_since_type": {
      const value = typeof c.value === "object" && c.value !== null ? c.value : {};
      const days = f.moment_days_by_type.get(String(value.moment_type_id || ""));
      if (days === undefined) return false;
      return c.operator === "lte" ? days <= Number(value.days) : days >= Number(value.days);
    }

    case "moment.any_recent_in_days": {
      const v = windowCountValue(c.value);
      return cmp(getWindowCount(f.any_moment_recent_in_days, v.days), c.operator, v.count);
    }

    case "moment.has_salvation":
      return f.has_salvation;

    case "online.watched_recent_in_days": {
      const v = windowCountValue(c.value);
      return cmp(getWindowCount(f.online_watched_in_days, v.days), c.operator, v.count);
    }

    case "online.prayer_recent_in_days": {
      const v = windowCountValue(c.value);
      return cmp(getWindowCount(f.online_prayer_in_days, v.days), c.operator, v.count);
    }

    default:
      return false;
  }
}

function evalRule(
  combinator: "AND" | "OR",
  conditions: Condition[],
  f: ContactFacts,
): boolean {
  if (!conditions.length) return false;
  // Group 0 = top-level; non-zero groups combine with the OPPOSITE operator.
  const groups = new Map<number, Condition[]>();
  for (const c of conditions) {
    const g = c.condition_group ?? 0;
    (groups.get(g) ?? groups.set(g, []).get(g)!).push(c);
  }
  const inner: "AND" | "OR" = combinator === "AND" ? "OR" : "AND";
  const items: boolean[] = [];
  for (const c of groups.get(0) ?? []) items.push(evalCond(c, f));
  for (const [gid, list] of groups) {
    if (gid === 0) continue;
    const res = list.map((c) => evalCond(c, f));
    items.push(inner === "AND" ? res.every(Boolean) : res.some(Boolean));
  }
  return combinator === "AND" ? items.every(Boolean) : items.some(Boolean);
}

async function loadFacts(
  sb: any,
  orgId: string,
  windowDays: number[],
): Promise<Map<string, ContactFacts>> {
  const defaultWindows = [1, 7, 14, 21, 28, 30, 42, 60, 90, 180, 365];
  const allWindows = Array.from(new Set([...defaultWindows, ...windowDays])).sort((a, b) => a - b);
  const now = Date.now();
  const facts = new Map<string, ContactFacts>();

  // Contacts
  const { data: contacts } = await sb
    .from("contacts")
    .select("id, campus_id")
    .eq("organization_id", orgId)
    .limit(50000);
  for (const c of contacts || []) {
    facts.set((c as any).id, {
      contact_id: (c as any).id,
      campus_id: (c as any).campus_id || null,
      last_service_days_ago: null,
      services_last_12w: 0,
      lifetime_checkins: 0,
      never_attended: true,
      is_first_time_guest: false,
      checkins_in_days: new Map(),
      distinct_weeks_in_window: new Map(),
      guest_checkins_in_days: new Map(),
      household_checkins_in_days: new Map(),
      weeks_last_12: 0,
      weeks_prior_12: 0,
      is_in_group: false,
      group_attendance_rate: null,
      group_meetings_count: 0,
      last_group_attended_days_ago: null,
      never_attended_group: true,
      days_since_last_serve: null,
      never_served: true,
      volunteer_checkins_in_days: new Map(),
      in_any_flow: false,
      active_flow_ids: new Set(),
      active_stage_ids: new Set(),
      days_in_stage: null,
      moment_days_by_type: new Map(),
      any_moment_recent_in_days: new Map(),
      has_salvation: false,
      online_watched_in_days: new Map(),
      online_prayer_in_days: new Map(),
      tags: new Set(),
    });
  }

  // Household links (for kids_checked_in)
  const householdLinks = new Map<string, Set<string>>(); // contact_id -> Set<hh_contact_id>
  const { data: hhContacts } = await sb
    .from("contacts")
    .select("id, pc_household_id")
    .eq("organization_id", orgId)
    .not("pc_household_id", "is", null)
    .limit(50000);
  const householdMembers = new Map<string, Set<string>>(); // pc_household_id -> Set<contact_id>
  for (const c of hhContacts || []) {
    const hid = (c as any).pc_household_id as string;
    const cid = (c as any).id as string;
    if (!hid || !cid) continue;
    if (!householdMembers.has(hid)) householdMembers.set(hid, new Set());
    householdMembers.get(hid)!.add(cid);
  }
  for (const c of hhContacts || []) {
    const cid = (c as any).id as string;
    const hid = (c as any).pc_household_id as string;
    const members = householdMembers.get(hid);
    if (!members) continue;
    const others = new Set(members);
    others.delete(cid);
    if (others.size) householdLinks.set(cid, others);
  }

  // Check-ins (service attendance) — load all for lifetime/last-service exactness
  const ownCheckins: Array<{ contact_id: string; checked_in_at: string; checkin_kind: string | null }> = [];
  let checkinOffset = 0;
  const CHECKIN_PAGE = 50000;
  while (true) {
    const { data: page } = await sb
      .from("pco_checkins")
      .select("contact_id, checked_in_at, checkin_kind")
      .eq("organization_id", orgId)
      .order("checked_in_at", { ascending: true })
      .range(checkinOffset, checkinOffset + CHECKIN_PAGE - 1);
    const rows = (page || []) as any[];
    if (!rows.length) break;
    for (const row of rows) {
      ownCheckins.push({
        contact_id: row.contact_id as string,
        checked_in_at: row.checked_in_at as string,
        checkin_kind: (row.checkin_kind || null) as string | null,
      });
    }
    if (rows.length < CHECKIN_PAGE) break;
    checkinOffset += CHECKIN_PAGE;
  }

  const twelveWksAgo = now - 84 * 86400000;
  const twentyFourWksAgo = now - 168 * 86400000;
  const firstSeen = new Map<string, string>();

  for (const ci of ownCheckins) {
    const cid = ci.contact_id;
    if (!cid) continue;
    const f = facts.get(cid);
    if (!f) continue;

    f.never_attended = false;
    f.lifetime_checkins += 1;

    const atMs = new Date(ci.checked_in_at).getTime();
    const days = daysBetween(ci.checked_in_at);

    if (days !== null && (f.last_service_days_ago === null || days < f.last_service_days_ago)) {
      f.last_service_days_ago = days;
    }

    if (atMs >= twelveWksAgo) {
      f.services_last_12w += 1;
    }

    // Track first-seen date for first-time guest heuristic
    const prev = firstSeen.get(cid);
    if (!prev || ci.checked_in_at < prev) firstSeen.set(cid, ci.checked_in_at);

    // Distinct weeks in rolling windows (store for any configured window on demand below)
    const weekKey = startOfWeekIso(ci.checked_in_at);

    // Guest check-ins by window
    if (ci.checkin_kind === "guest") {
      for (const days of allWindows) {
        if (atMs >= now - days * 86400000) {
          f.guest_checkins_in_days.set(days, (f.guest_checkins_in_days.get(days) || 0) + 1);
        }
      }
    }
  }

  // Compute windowed counts and distinct weeks after all check-ins are loaded
  for (const [cid, f] of facts) {
    const myCheckins = ownCheckins.filter((c) => c.contact_id === cid);
    const weeksByWindow = new Map<number, Set<string>>();
    for (const ci of myCheckins) {
      const atMs = new Date(ci.checked_in_at).getTime();
      for (const days of allWindows) {
        if (atMs >= now - days * 86400000) {
          f.checkins_in_days.set(days, (f.checkins_in_days.get(days) || 0) + 1);
          if (!weeksByWindow.has(days)) weeksByWindow.set(days, new Set());
          weeksByWindow.get(days)!.add(startOfWeekIso(ci.checked_in_at));
        }
      }
    }
    for (const [days, weeks] of weeksByWindow) {
      f.distinct_weeks_in_window.set(days, weeks.size);
    }

    // Distinct ISO weeks for last-12 and prior-12 windows
    const weeksLast12 = new Set<string>();
    const weeksPrior12 = new Set<string>();
    for (const ci of myCheckins) {
      const atMs = new Date(ci.checked_in_at).getTime();
      if (atMs >= twelveWksAgo) weeksLast12.add(startOfWeekIso(ci.checked_in_at));
      if (atMs >= twentyFourWksAgo && atMs < twelveWksAgo) {
        weeksPrior12.add(startOfWeekIso(ci.checked_in_at));
      }
    }
    f.weeks_last_12 = weeksLast12.size;
    f.weeks_prior_12 = weeksPrior12.size;

    // First-time guest = exactly one checkin in last 12 weeks, within 30 days
    if (f.services_last_12w === 1) {
      const first = firstSeen.get(cid);
      const d = daysBetween(first ?? null);
      if (d !== null && d <= 30) f.is_first_time_guest = true;
    }
  }

  // Household check-ins
  const householdCheckins: Array<{ contact_id: string; checked_in_at: string }> = [];
  for (const [cid, others] of householdLinks) {
    for (const otherCid of others) {
      const otherFacts = facts.get(otherCid);
      if (!otherFacts) continue;
      for (const ci of ownCheckins) {
        if (ci.contact_id === otherCid) {
          householdCheckins.push({ contact_id: cid, checked_in_at: ci.checked_in_at });
        }
      }
    }
  }
  for (const hc of householdCheckins) {
    const f = facts.get(hc.contact_id);
    if (!f) continue;
    const atMs = new Date(hc.checked_in_at).getTime();
    for (const days of allWindows) {
      if (atMs >= now - days * 86400000) {
        f.household_checkins_in_days.set(days, (f.household_checkins_in_days.get(days) || 0) + 1);
      }
    }
  }

  // Groups (join through groups because group_members has no organization_id)
  const { data: gm } = await sb
    .from("group_members")
    .select("contact_id, group_id, id, status, last_attended_at, group:groups!inner(organization_id)")
    .eq("group.organization_id", orgId)
    .limit(100000);
  const activeGroupMemberIds = new Set<string>();
  const groupMemberToGroup = new Map<string, string>();
  const groupMemberLastAttended = new Map<string, string | null>();
  for (const m of gm || []) {
    const cid = (m as any).contact_id as string;
    const f = facts.get(cid);
    if (!f) continue;
    const status = String((m as any).status || "");
    if (status !== "inactive") f.is_in_group = true;
    const gmId = (m as any).id as string;
    if (status === "active") {
      activeGroupMemberIds.add(gmId);
      groupMemberToGroup.set(gmId, (m as any).group_id as string);
      groupMemberLastAttended.set(gmId, (m as any).last_attended_at || null);
    }
  }

  // Recent group meetings per group (last 8)
  const { data: orgGroups } = await sb
    .from("groups")
    .select("id")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .limit(50000);
  const activeGroupIds = new Set((orgGroups || []).map((g: any) => g.id as string));

  const recentMeetingsByGroup = new Map<string, Array<{ id: string; meeting_date: string }>>();
  if (activeGroupIds.size) {
    const { data: meetings } = await sb
      .from("group_meetings")
      .select("id, group_id, meeting_date")
      .in("group_id", Array.from(activeGroupIds))
      .order("meeting_date", { ascending: false })
      .limit(200000);
    const perGroup = new Map<string, Array<{ id: string; meeting_date: string }>>();
    for (const m of meetings || []) {
      const gid = (m as any).group_id as string;
      if (!perGroup.has(gid)) perGroup.set(gid, []);
      perGroup.get(gid)!.push({ id: (m as any).id as string, meeting_date: (m as any).meeting_date as string });
    }
    for (const [gid, list] of perGroup) {
      recentMeetingsByGroup.set(gid, list.slice(0, 8));
    }
  }

  // Group attendance over recent meetings
  const meetingIds = new Set<string>();
  for (const list of recentMeetingsByGroup.values()) {
    for (const m of list) meetingIds.add(m.id);
  }
  const attendanceByMember = new Map<string, { present: number; total: number; lastPresent: string | null }>();
  if (meetingIds.size && activeGroupMemberIds.size) {
    const { data: ga } = await sb
      .from("group_attendance")
      .select("group_member_id, group_meeting_id, status, checked_in_at")
      .in("group_member_id", Array.from(activeGroupMemberIds))
      .in("group_meeting_id", Array.from(meetingIds))
      .limit(200000);
    for (const a of ga || []) {
      const gmId = (a as any).group_member_id as string;
      const status = String((a as any).status || "");
      const s = attendanceByMember.get(gmId) ?? { present: 0, total: 0, lastPresent: null };
      s.total += 1;
      if (status === "present") {
        s.present += 1;
        const at = (a as any).checked_in_at as string;
        if (at && (!s.lastPresent || at > s.lastPresent)) s.lastPresent = at;
      }
      attendanceByMember.set(gmId, s);
    }
  }

  for (const gmId of activeGroupMemberIds) {
    const cid = ((gm || []) as any[]).find((m: any) => m.id === gmId)?.contact_id as string | undefined;
    if (!cid) continue;
    const f = facts.get(cid);
    if (!f) continue;

    const gid = groupMemberToGroup.get(gmId);
    const recentMeetings = gid ? recentMeetingsByGroup.get(gid) || [] : [];
    const totalMeetings = recentMeetings.length;
    const attended = attendanceByMember.get(gmId) || { present: 0, total: 0, lastPresent: null };

    if (totalMeetings > 0) {
      f.group_meetings_count = totalMeetings;
      f.group_attendance_rate = Math.round((attended.present / totalMeetings) * 100);
      f.never_attended_group = attended.present === 0;
    } else if (attended.total > 0) {
      // Fallback when no recent meetings are loaded but attendance records exist
      f.group_meetings_count = attended.total;
      f.group_attendance_rate = Math.round((attended.present / attended.total) * 100);
      f.never_attended_group = attended.present === 0;
    }

    if (attended.lastPresent) {
      const d = daysBetween(attended.lastPresent);
      if (d !== null && (f.last_group_attended_days_ago === null || d < f.last_group_attended_days_ago)) {
        f.last_group_attended_days_ago = d;
      }
    }
    const lastAttendedAt = groupMemberLastAttended.get(gmId);
    if (lastAttendedAt) {
      const d = daysBetween(lastAttendedAt);
      if (d !== null && (f.last_group_attended_days_ago === null || d < f.last_group_attended_days_ago)) {
        f.last_group_attended_days_ago = d;
      }
    }
  }
  // Contacts in a group but with no attendance records stay never_attended_group=true

  // Serving — volunteer check-ins
  const volunteerCheckins: Array<{ contact_id: string; checked_in_at: string }> = [];
  let serveOffset = 0;
  const SERVE_PAGE = 50000;
  while (true) {
    const { data: page } = await sb
      .from("pco_checkins")
      .select("contact_id, checked_in_at, checkin_kind")
      .eq("organization_id", orgId)
      .ilike("checkin_kind", "%volunteer%")
      .order("checked_in_at", { ascending: true })
      .range(serveOffset, serveOffset + SERVE_PAGE - 1);
    const rows = (page || []) as any[];
    if (!rows.length) break;
    for (const row of rows) {
      volunteerCheckins.push({
        contact_id: row.contact_id as string,
        checked_in_at: row.checked_in_at as string,
      });
    }
    if (rows.length < SERVE_PAGE) break;
    serveOffset += SERVE_PAGE;
  }

  const lastServe = new Map<string, string>();
  for (const s of volunteerCheckins) {
    const cid = s.contact_id;
    if (!cid) continue;
    const f = facts.get(cid);
    if (!f) continue;
    f.never_served = false;
    if (!lastServe.has(cid)) lastServe.set(cid, s.checked_in_at);
    const atMs = new Date(s.checked_in_at).getTime();
      for (const days of allWindows) {
        if (atMs >= now - days * 86400000) {
          f.volunteer_checkins_in_days.set(days, (f.volunteer_checkins_in_days.get(days) || 0) + 1);
        }
      }
  }
  for (const [cid, at] of lastServe) {
    const f = facts.get(cid);
    if (f) f.days_since_last_serve = daysBetween(at);
  }

  // Flows (pipeline_contacts)
  const { data: orgFlows } = await sb
    .from("pipelines")
    .select("id")
    .eq("organization_id", orgId);
  const flowIds = (orgFlows || []).map((flow: any) => flow.id as string);
  const { data: pc } = flowIds.length
    ? await sb
      .from("pipeline_contacts")
      .select("contact_id, pipeline_id, stage_id, stage_entered_at, completed_end_at")
      .in("pipeline_id", flowIds)
      .is("completed_end_at", null)
      .limit(100000)
    : { data: [] };
  for (const p of pc || []) {
    const cid = (p as any).contact_id;
    const f = facts.get(cid);
    if (!f) continue;
    f.in_any_flow = true;
    f.active_flow_ids.add((p as any).pipeline_id);
    f.active_stage_ids.add((p as any).stage_id);
    const d = daysBetween((p as any).stage_entered_at);
    if (d !== null && (f.days_in_stage === null || d > f.days_in_stage)) f.days_in_stage = d;
  }

  // Flow Moments
  const { data: momentTypes } = await sb
    .from("flow_moment_types")
    .select("id, category, name")
    .eq("organization_id", orgId)
    .eq("is_active", true);
  const momentTypeIds = (momentTypes || []).map((type: any) => type.id as string);
  const salvationTypeIds = new Set(
    (momentTypes || [])
      .filter((t: any) => {
        const cat = String(t.category || "").toLowerCase();
        const name = String(t.name || "").toLowerCase();
        return cat === "salvation" || name.includes("salvation") || name.includes("decision");
      })
      .map((t: any) => t.id as string),
  );

  if (momentTypeIds.length) {
    const { data: moments } = await sb
      .from("flow_moments")
      .select("contact_id, flow_moment_type_id, occurred_at")
      .in("flow_moment_type_id", momentTypeIds)
      .order("occurred_at", { ascending: false })
      .limit(100000);
    for (const moment of moments || []) {
      const f = facts.get((moment as any).contact_id);
      if (!f) continue;
      const typeId = (moment as any).flow_moment_type_id as string;
      const days = daysBetween((moment as any).occurred_at);
      if (days === null) continue;

      // Latest per type
      const previous = f.moment_days_by_type.get(typeId);
      if (previous === undefined || days < previous) f.moment_days_by_type.set(typeId, days);

      // Any moment window counts
      for (const windowDays of allWindows) {
        if (days <= windowDays) {
          f.any_moment_recent_in_days.set(
            windowDays,
            (f.any_moment_recent_in_days.get(windowDays) || 0) + 1,
          );
        }
      }

      // Salvation (only within the last 365 days, matching SQL)
      if (salvationTypeIds.has(typeId) && days !== null && days <= 365) {
        f.has_salvation = true;
      }
    }
  }

  // Church Online events
  const { data: onlineEvents } = await sb
    .from("church_online_events")
    .select("contact_id, event_type, created_at")
    .eq("organization_id", orgId)
    .limit(100000);
  for (const e of onlineEvents || []) {
    const f = facts.get((e as any).contact_id);
    if (!f) continue;
    const days = daysBetween((e as any).created_at);
    if (days === null) continue;
    const type = String((e as any).event_type || "").toLowerCase();
    for (const windowDays of allWindows) {
      if (days <= windowDays) {
        f.online_watched_in_days.set(windowDays, (f.online_watched_in_days.get(windowDays) || 0) + 1);
        if (type.includes("prayer")) {
          f.online_prayer_in_days.set(windowDays, (f.online_prayer_in_days.get(windowDays) || 0) + 1);
        }
      }
    }
  }

  // Tags
  const { data: tags } = await sb
    .from("contact_tags")
    .select("contact_id, tag")
    .eq("organization_id", orgId)
    .limit(200000);
  for (const t of tags || []) {
    const f = facts.get((t as any).contact_id);
    if (f) f.tags.add(String((t as any).tag || "").toLowerCase());
  }

  return facts;
}

async function evaluateOrg(sb: any, orgId: string) {
  const { data: signals } = await sb
    .from("custom_signals")
    .select("id, organization_id, enabled")
    .eq("organization_id", orgId)
    .eq("enabled", true);
  if (!signals?.length) return { signals: 0, matches: 0 };

  const { data: rules } = await sb
    .from("custom_signal_rules")
    .select("signal_id, rule_combinator, conditions")
    .in("signal_id", signals.map((s: any) => s.id));
  const rulesBySignal = new Map<string, any>();
  for (const r of rules || []) rulesBySignal.set((r as any).signal_id, r);

  const allConditions = (rules || []).flatMap((r: any) => r.conditions || []);
  const facts = await loadFacts(sb, orgId, extractWindowDays(allConditions));

  const now = new Date().toISOString();
  let totalMatches = 0;

  for (const sig of signals as any[]) {
    const rule = rulesBySignal.get(sig.id);
    if (!rule) continue;
    const combinator = (rule.rule_combinator || "AND") as "AND" | "OR";
    const conditions = (rule.conditions || []) as Condition[];

    const matched: string[] = [];
    for (const [cid, f] of facts) {
      if (evalRule(combinator, conditions, f)) matched.push(cid);
    }
    totalMatches += matched.length;

    // Current matches for this signal
    const { data: existing } = await sb
      .from("custom_signal_contacts")
      .select("id, contact_id, cleared_at")
      .eq("signal_id", sig.id);
    const existingMap = new Map<string, any>();
    for (const e of existing || []) existingMap.set((e as any).contact_id, e);

    // Upsert new matches
    const toInsert: any[] = [];
    const toReopen: string[] = [];
    for (const cid of matched) {
      const row = existingMap.get(cid);
      if (!row) {
        toInsert.push({
          signal_id: sig.id,
          contact_id: cid,
          organization_id: orgId,
          matched_at: now,
        });
      } else if (row.cleared_at) {
        toReopen.push(row.id);
      }
    }
    if (toInsert.length) {
      await sb.from("custom_signal_contacts").insert(toInsert as any);
    }
    if (toReopen.length) {
      await sb
        .from("custom_signal_contacts")
        .update({ matched_at: now, cleared_at: null } as any)
        .in("id", toReopen);
    }

    // Clear stale matches
    const matchedSet = new Set(matched);
    const toClear = (existing || [])
      .filter((e: any) => !e.cleared_at && !matchedSet.has(e.contact_id))
      .map((e: any) => e.id);
    if (toClear.length) {
      await sb
        .from("custom_signal_contacts")
        .update({ cleared_at: now } as any)
        .in("id", toClear);
    }
  }

  return { signals: signals.length, matches: totalMatches };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const orgId = body.organization_id as string | undefined;

    let orgIds: string[] = [];
    if (orgId) {
      orgIds = [orgId];
    } else {
      const { data } = await sb
        .from("organization_features")
        .select("organization_id")
        .eq("feature_key", "custom_signals")
        .eq("enabled", true);
      orgIds = (data || []).map((r: any) => r.organization_id);
    }

    const results: any[] = [];
    for (const id of orgIds) {
      try {
        const r = await evaluateOrg(sb, id);
        results.push({ organization_id: id, ...r });
      } catch (e) {
        results.push({ organization_id: id, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-custom-signals error", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

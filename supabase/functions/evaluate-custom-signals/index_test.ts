import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Re-import the internal functions by evaluating the module in a test-friendly way.
// We import the file as a module and rely on the fact that Deno.serve won't run
// during the test because no request is made.
const module = await import("./index.ts");

// The internal functions are not exported, so we re-implement the public
// condition-evaluation helpers here to test the logic.
// NOTE: Keep these in sync with index.ts.

function daysBetween(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function getWindowCount(m: Map<number, number>, days: number): number | null {
  return m.has(days) ? m.get(days)! : null;
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

function baseFacts(): any {
  return {
    contact_id: "c1",
    campus_id: null,
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
  };
}

function evalCond(c: any, f: any): boolean {
  switch (c.source) {
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
    case "attendance.weeks_last_12":
      return cmp(f.weeks_last_12, c.operator, Number(c.value));
    case "attendance.weeks_prior_12":
      return cmp(f.weeks_prior_12, c.operator, Number(c.value));
    case "attendance.weeks_last_12_ratio_to_prior": {
      if (f.weeks_prior_12 === 0) return false;
      const ratio = Math.round((f.weeks_last_12 * 100) / f.weeks_prior_12);
      return cmp(ratio, c.operator, Number(c.value));
    }
    case "group.is_in_group":
      return c.operator === "true" ? f.is_in_group : !f.is_in_group;
    case "group.never_attended":
      return f.never_attended_group;
    case "group.last_attended_days_ago":
      return cmp(f.last_group_attended_days_ago, c.operator, Number(c.value));
    case "group.meetings_count":
      return cmp(f.group_meetings_count, c.operator, Number(c.value));
    case "group.attendance_rate":
      return f.group_attendance_rate === null ? false : cmp(f.group_attendance_rate, c.operator, Number(c.value));
    case "serve.checkins_in_days": {
      const v = windowCountValue(c.value);
      return cmp(getWindowCount(f.volunteer_checkins_in_days, v.days), c.operator, v.count);
    }
    case "serve.never_served":
      return f.never_served;
    case "serve.days_since_last":
      return cmp(f.days_since_last_serve, c.operator, Number(c.value));
    case "flow.in_any_flow":
      return c.operator === "true" ? f.in_any_flow : !f.in_any_flow;
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

function evalRule(combinator: "AND" | "OR", conditions: any[], f: any): boolean {
  if (!conditions.length) return false;
  const groups = new Map<number, any[]>();
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

Deno.test("attended_sunday_recent exact via checkins_in_days", () => {
  const f = baseFacts();
  f.checkins_in_days.set(14, 1);
  assertEquals(evalCond({ source: "attendance.checkins_in_days", operator: "gte", value: { days: 14, count: 1 } }, f), true);
  f.checkins_in_days.set(14, 0);
  assertEquals(evalCond({ source: "attendance.checkins_in_days", operator: "gte", value: { days: 14, count: 1 } }, f), false);
});

Deno.test("consistent_attender via distinct_weeks_in_window", () => {
  const f = baseFacts();
  f.distinct_weeks_in_window.set(28, 3);
  assertEquals(evalCond({ source: "attendance.distinct_weeks_in_window", operator: "gte", value: { days: 28, count: 3 } }, f), true);
  f.distinct_weeks_in_window.set(28, 2);
  assertEquals(evalCond({ source: "attendance.distinct_weeks_in_window", operator: "gte", value: { days: 28, count: 3 } }, f), false);
});

Deno.test("missed_3_sundays lifetime gate plus range", () => {
  const f = baseFacts();
  f.lifetime_checkins = 4;
  f.never_attended = false;
  f.last_service_days_ago = 25;
  assertEquals(
    evalRule("OR", [
      { source: "attendance.lifetime_checkins", operator: "gte", value: 4, condition_group: 1 },
      { source: "attendance.never_attended", operator: "true", value: "", condition_group: 1 },
      { source: "attendance.lifetime_checkins", operator: "gte", value: 4, condition_group: 2 },
      { source: "attendance.last_service_days_ago", operator: "gt", value: 21, condition_group: 2 },
      { source: "attendance.last_service_days_ago", operator: "lte", value: 42, condition_group: 2 },
    ], f),
    true,
  );

  f.last_service_days_ago = 21;
  assertEquals(
    evalRule("OR", [
      { source: "attendance.lifetime_checkins", operator: "gte", value: 4, condition_group: 1 },
      { source: "attendance.never_attended", operator: "true", value: "", condition_group: 1 },
      { source: "attendance.lifetime_checkins", operator: "gte", value: 4, condition_group: 2 },
      { source: "attendance.last_service_days_ago", operator: "gt", value: 21, condition_group: 2 },
      { source: "attendance.last_service_days_ago", operator: "lte", value: 42, condition_group: 2 },
    ], f),
    false,
  );
});

Deno.test("missed_3_sundays never_attended branch", () => {
  const f = baseFacts();
  f.lifetime_checkins = 4;
  f.never_attended = true;
  assertEquals(
    evalRule("OR", [
      { source: "attendance.lifetime_checkins", operator: "gte", value: 4, condition_group: 1 },
      { source: "attendance.never_attended", operator: "true", value: "", condition_group: 1 },
      { source: "attendance.lifetime_checkins", operator: "gte", value: 4, condition_group: 2 },
      { source: "attendance.last_service_days_ago", operator: "gt", value: 21, condition_group: 2 },
      { source: "attendance.last_service_days_ago", operator: "lte", value: 42, condition_group: 2 },
    ], f),
    true,
  );
});

Deno.test("attendance_dropped ratio", () => {
  const f = baseFacts();
  f.weeks_prior_12 = 6;
  f.weeks_last_12 = 2;
  assertEquals(
    evalRule("AND", [
      { source: "attendance.weeks_prior_12", operator: "gte", value: 4 },
      { source: "attendance.weeks_last_12_ratio_to_prior", operator: "lte", value: 50 },
    ], f),
    true,
  );
  f.weeks_last_12 = 4;
  assertEquals(
    evalRule("AND", [
      { source: "attendance.weeks_prior_12", operator: "gte", value: 4 },
      { source: "attendance.weeks_last_12_ratio_to_prior", operator: "lte", value: 50 },
    ], f),
    false,
  );
});

Deno.test("group_attendance_high requires meetings and rate", () => {
  const f = baseFacts();
  f.group_meetings_count = 3;
  f.group_attendance_rate = 70;
  assertEquals(
    evalRule("AND", [
      { source: "group.meetings_count", operator: "gte", value: 3 },
      { source: "group.attendance_rate", operator: "gte", value: 66 },
    ], f),
    true,
  );
  f.group_meetings_count = 2;
  assertEquals(
    evalRule("AND", [
      { source: "group.meetings_count", operator: "gte", value: 3 },
      { source: "group.attendance_rate", operator: "gte", value: 66 },
    ], f),
    false,
  );
});

Deno.test("group_attendance_mid band", () => {
  const f = baseFacts();
  f.group_meetings_count = 3;
  f.group_attendance_rate = 50;
  assertEquals(
    evalRule("AND", [
      { source: "group.meetings_count", operator: "gte", value: 3 },
      { source: "group.attendance_rate", operator: "gte", value: 33 },
      { source: "group.attendance_rate", operator: "lt", value: 66 },
    ], f),
    true,
  );
});

Deno.test("group_inactive_30d", () => {
  const f = baseFacts();
  f.is_in_group = true;
  f.last_group_attended_days_ago = 35;
  assertEquals(
    evalRule("AND", [
      { source: "group.is_in_group", operator: "true", value: "" },
      { source: "group.never_attended", operator: "true", value: "", condition_group: 1 },
      { source: "group.last_attended_days_ago", operator: "gt", value: 30, condition_group: 1 },
    ], f),
    true,
  );
});

Deno.test("serves_regularly count threshold", () => {
  const f = baseFacts();
  f.volunteer_checkins_in_days.set(90, 3);
  assertEquals(evalCond({ source: "serve.checkins_in_days", operator: "gte", value: { days: 90, count: 3 } }, f), true);
  f.volunteer_checkins_in_days.set(90, 2);
  assertEquals(evalCond({ source: "serve.checkins_in_days", operator: "gte", value: { days: 90, count: 3 } }, f), false);
});

Deno.test("stopped_serving three-part rule", () => {
  const f = baseFacts();
  f.never_served = false;
  f.volunteer_checkins_in_days.set(180, 3);
  f.volunteer_checkins_in_days.set(90, 0);
  f.days_since_last_serve = 65;
  assertEquals(
    evalRule("AND", [
      { source: "serve.checkins_in_days", operator: "gte", value: { days: 180, count: 3 } },
      { source: "serve.checkins_in_days", operator: "eq", value: { days: 90, count: 0 } },
      { source: "serve.never_served", operator: "true", value: "", condition_group: 1 },
      { source: "serve.days_since_last", operator: "gt", value: 60, condition_group: 1 },
    ], f),
    true,
  );
});

Deno.test("flow_moment_recent", () => {
  const f = baseFacts();
  f.any_moment_recent_in_days.set(90, 1);
  assertEquals(evalCond({ source: "moment.any_recent_in_days", operator: "gte", value: { days: 90, count: 1 } }, f), true);
});

Deno.test("salvation_moment", () => {
  const f = baseFacts();
  f.has_salvation = true;
  assertEquals(evalCond({ source: "moment.has_salvation", operator: "true", value: "" }, f), true);
});

Deno.test("online events", () => {
  const f = baseFacts();
  f.online_watched_in_days.set(30, 1);
  assertEquals(evalCond({ source: "online.watched_recent_in_days", operator: "gte", value: { days: 30, count: 1 } }, f), true);
  f.online_prayer_in_days.set(90, 1);
  assertEquals(evalCond({ source: "online.prayer_recent_in_days", operator: "gte", value: { days: 90, count: 1 } }, f), true);
});

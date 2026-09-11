import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  cmp,
  evalCond,
  evalRule,
  extractWindowDays,
  startOfWeekIso,
  type ContactFacts,
} from "./index.ts";

function baseFacts(): ContactFacts {
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
    first_seen_days_ago: null,
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

Deno.test("cmp operators", () => {
  assertEquals(cmp(5, "gte", 5), true);
  assertEquals(cmp(5, "gt", 5), false);
  assertEquals(cmp(5, "lte", 5), true);
  assertEquals(cmp(5, "lt", 5), false);
  assertEquals(cmp(null, "gte", 5), false);
});

Deno.test("startOfWeekIso uses Monday weeks", () => {
  // 2026-09-14 is a Monday
  assertEquals(startOfWeekIso("2026-09-14T12:00:00Z"), "2026-09-14");
  // 2026-09-13 is a Sunday, should roll back to Monday 2026-09-07
  assertEquals(startOfWeekIso("2026-09-13T12:00:00Z"), "2026-09-07");
  // 2026-09-19 is a Saturday, should roll back to Monday 2026-09-14
  assertEquals(startOfWeekIso("2026-09-19T12:00:00Z"), "2026-09-14");
});

Deno.test("extractWindowDays gathers unique windows from conditions", () => {
  const conditions = [
    { source: "attendance.checkins_in_days", operator: "gte", value: { days: 14, count: 1 } },
    { source: "serve.checkins_in_days", operator: "gte", value: { days: 90, count: 3 } },
    { source: "attendance.checkins_in_days", operator: "gte", value: { days: 14, count: 2 } },
    { source: "online.watched_recent_in_days", operator: "gte", value: { days: 30, count: 1 } },
    { source: "attendance.last_service_days_ago", operator: "lte", value: 7 },
  ];
  assertEquals(extractWindowDays(conditions), [14, 30, 90]);
});

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

Deno.test("salvation_moment only within 365 days", () => {
  const f = baseFacts();
  f.has_salvation = true;
  assertEquals(evalCond({ source: "moment.has_salvation", operator: "true", value: "" }, f), true);

  // The evaluator reads the precomputed boolean; loadFacts limits salvation to <= 365 days.
  // This test documents that the condition itself is a simple boolean read.
  f.has_salvation = false;
  assertEquals(evalCond({ source: "moment.has_salvation", operator: "true", value: "" }, f), false);
});

Deno.test("online events", () => {
  const f = baseFacts();
  f.online_watched_in_days.set(30, 1);
  assertEquals(evalCond({ source: "online.watched_recent_in_days", operator: "gte", value: { days: 30, count: 1 } }, f), true);
  f.online_prayer_in_days.set(90, 1);
  assertEquals(evalCond({ source: "online.prayer_recent_in_days", operator: "gte", value: { days: 90, count: 1 } }, f), true);
});

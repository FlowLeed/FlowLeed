export interface MarkerParamDescriptor {
  key: string;
  label: string;
  suffix?: string;
  default: number;
  min: number;
  max: number;
}

/**
 * Which numbers each built-in signal exposes for per-church tuning.
 * Signals not listed here can be renamed / turned off but not re-timed.
 */
export const markerParamSpecs: Record<string, MarkerParamDescriptor[]> = {
  attended_sunday_recent: [
    { key: "days", label: "Counts as recent if checked in within the last", suffix: "days", default: 14, min: 1, max: 120 },
  ],
  consistent_attender: [
    { key: "min_weeks", label: "Must have attended at least", suffix: "weeks", default: 3, min: 1, max: 12 },
    { key: "window_weeks", label: "Out of the last", suffix: "weeks", default: 4, min: 2, max: 26 },
  ],
  first_time_guest: [
    { key: "days", label: "Guest check-in within the last", suffix: "days", default: 30, min: 1, max: 180 },
  ],
  kids_checked_in: [
    { key: "days", label: "Household check-in within the last", suffix: "days", default: 30, min: 1, max: 180 },
  ],
  missed_3_sundays: [
    { key: "min_days", label: "No attendance for at least", suffix: "days", default: 21, min: 7, max: 180 },
    { key: "max_days", label: "But not longer than", suffix: "days", default: 42, min: 8, max: 365 },
    { key: "min_lifetime_checkins", label: "Was previously regular with at least", suffix: "check-ins", default: 4, min: 1, max: 50 },
  ],
  drifting_6_weeks: [
    { key: "days", label: "No attendance for more than", suffix: "days", default: 42, min: 14, max: 365 },
    { key: "min_lifetime_checkins", label: "Was previously regular with at least", suffix: "check-ins", default: 4, min: 1, max: 50 },
  ],
  attendance_dropped: [
    { key: "min_prior_weeks", label: "Attended at least this many of the prior 12 weeks", suffix: "weeks", default: 4, min: 2, max: 12 },
  ],
  group_inactive_30d: [
    { key: "days", label: "No group attendance for at least", suffix: "days", default: 30, min: 7, max: 365 },
  ],
  served_recently: [
    { key: "days", label: "Served within the last", suffix: "days", default: 30, min: 1, max: 180 },
  ],
  serves_regularly: [
    { key: "min_times", label: "Served at least", suffix: "times", default: 3, min: 1, max: 50 },
    { key: "days", label: "Within the last", suffix: "days", default: 90, min: 7, max: 365 },
  ],
  stopped_serving: [
    { key: "min_times", label: "Used to serve at least", suffix: "times", default: 3, min: 1, max: 50 },
    { key: "lookback_days", label: "Within the last", suffix: "days", default: 180, min: 30, max: 730 },
    { key: "recent_days", label: "But has not served in the last", suffix: "days", default: 90, min: 7, max: 365 },
    { key: "quiet_days", label: "And last served more than", suffix: "days ago", default: 60, min: 7, max: 365 },
  ],
  stuck_in_stage_30d: [
    { key: "days", label: "In the same flow stage for at least", suffix: "days", default: 30, min: 3, max: 365 },
  ],
  flow_moment_recent: [
    { key: "days", label: "Logged a next step within the last", suffix: "days", default: 90, min: 7, max: 365 },
  ],
  watched_online_recent: [
    { key: "days", label: "Watched online within the last", suffix: "days", default: 30, min: 1, max: 180 },
  ],
  prayer_request_submitted: [
    { key: "days", label: "Submitted a prayer request within the last", suffix: "days", default: 90, min: 7, max: 365 },
  ],
};

export function paramValue(
  params: Record<string, unknown> | null | undefined,
  spec: MarkerParamDescriptor
): number {
  const raw = params?.[spec.key];
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : spec.default;
}

function n(params: Record<string, unknown> | null | undefined, key: string, fallback: number) {
  const raw = params?.[key];
  const v = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(v) ? v : fallback;
}

/** Human explanation of how a signal is calculated, reflecting the church's own numbers. */
export function markerFormula(key: string, params?: Record<string, unknown> | null): string | undefined {
  const p = params || {};
  switch (key) {
    case "attended_sunday_recent":
      return `Fires when the contact has any service check-in in the last ${n(p, "days", 14)} days.`;
    case "consistent_attender":
      return `Attended a service in at least ${n(p, "min_weeks", 3)} of the last ${n(p, "window_weeks", 4)} weeks.`;
    case "first_time_guest":
      return `Has a check-in flagged as guest in the last ${n(p, "days", 30)} days.`;
    case "kids_checked_in":
      return `A household member checked in (e.g. kids) in the last ${n(p, "days", 30)} days.`;
    case "missed_3_sundays":
      return `Previously regular (${n(p, "min_lifetime_checkins", 4)}+ lifetime check-ins) AND last service attendance is between ${n(p, "min_days", 21)} and ${n(p, "max_days", 42)} days ago.`;
    case "drifting_6_weeks":
      return `Previously regular (${n(p, "min_lifetime_checkins", 4)}+ lifetime check-ins) AND last service attendance is more than ${n(p, "days", 42)} days ago (or never recorded).`;
    case "attendance_dropped":
      return `Attended ${n(p, "min_prior_weeks", 4)}+ of the prior 12 weeks, and the last 12 weeks are ≤ half of that prior count.`;
    case "in_group":
      return "Active member of at least one small group.";
    case "group_attendance_high":
      return "Attended ≥ 66% of the last 3+ group meetings.";
    case "group_attendance_mid":
      return "Attended 33–66% of the last 3+ group meetings.";
    case "group_attendance_low":
      return "Attended < 33% of the last 4+ group meetings.";
    case "group_inactive_30d":
      return `In a group but no group attendance in the last ${n(p, "days", 30)} days.`;
    case "served_recently":
      return `Volunteered / served at least once in the last ${n(p, "days", 30)} days.`;
    case "serves_regularly":
      return `Served ${n(p, "min_times", 3)}+ times in the last ${n(p, "days", 90)} days.`;
    case "stopped_serving":
      return `Served ${n(p, "min_times", 3)}+ times in the last ${n(p, "lookback_days", 180)} days, but 0 times in the last ${n(p, "recent_days", 90)}, and last serve was ${n(p, "quiet_days", 60)}+ days ago.`;
    case "in_active_flow":
      return "Currently in 1+ active flows.";
    case "stuck_in_stage_30d":
      return `Has been in their current flow stage for ${n(p, "days", 30)}+ days.`;
    case "flow_moment_recent":
      return `Logged 1+ flow moment (next step) in the last ${n(p, "days", 90)} days.`;
    case "salvation_moment":
      return "Has a salvation decision recorded.";
    case "watched_online_recent":
      return `Watched 1+ online events in the last ${n(p, "days", 30)} days.`;
    case "prayer_request_submitted":
      return `Submitted 1+ prayer requests in the last ${n(p, "days", 90)} days.`;
    default:
      return undefined;
  }
}

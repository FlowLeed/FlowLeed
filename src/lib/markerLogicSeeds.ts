import type { CustomSignalCondition, RuleCombinator, SignalSeverity } from "@/hooks/useCustomSignals";

export interface MarkerLogicSeed {
  combinator: RuleCombinator;
  conditions: CustomSignalCondition[];
  /** Shown when the built-in rule can't be fully expressed with the available conditions. */
  note?: string;
}

function n(params: Record<string, unknown> | null | undefined, key: string, fallback: number) {
  const raw = params?.[key];
  const v = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(v) ? v : fallback;
}

function cond(
  source: string,
  operator: string,
  value: any,
  group = 0
): CustomSignalCondition {
  return { source, operator, value, condition_group: group };
}

function windowCount(days: number, count: number) {
  return { days, count };
}

/** Exact condition-builder equivalent of each built-in signal, using the church's own numbers. */
export function markerLogicSeed(
  key: string,
  params?: Record<string, unknown> | null
): MarkerLogicSeed {
  const p = params || {};

  switch (key) {
    case "attended_sunday_recent":
      return {
        combinator: "AND",
        conditions: [
          cond("attendance.checkins_in_days", "gte", windowCount(n(p, "days", 14), 1)),
        ],
      };

    case "consistent_attender":
      return {
        combinator: "AND",
        conditions: [
          cond(
            "attendance.distinct_weeks_in_window",
            "gte",
            windowCount(n(p, "window_weeks", 4) * 7, n(p, "min_weeks", 3))
          ),
        ],
      };

    case "first_time_guest":
      return {
        combinator: "AND",
        conditions: [
          cond("attendance.guest_checkins_in_days", "gte", windowCount(n(p, "days", 30), 1)),
        ],
      };

    case "kids_checked_in":
      return {
        combinator: "AND",
        conditions: [
          cond("attendance.household_checkins_in_days", "gte", windowCount(n(p, "days", 30), 1)),
        ],
      };

    case "missed_3_sundays": {
      const minDays = n(p, "min_days", 21);
      const maxDays = n(p, "max_days", 42);
      const minLifetime = n(p, "min_lifetime_checkins", 4);
      return {
        // (lifetime >= X AND never attended) OR (lifetime >= X AND days in range)
        combinator: "OR",
        conditions: [
          cond("attendance.lifetime_checkins", "gte", minLifetime, 1),
          cond("attendance.never_attended", "true", "", 1),
          cond("attendance.lifetime_checkins", "gte", minLifetime, 2),
          cond("attendance.last_service_days_ago", "gt", minDays, 2),
          cond("attendance.last_service_days_ago", "lte", maxDays, 2),
        ],
      };
    }

    case "drifting_6_weeks": {
      const driftDays = n(p, "days", 42);
      const minLifetime = n(p, "min_lifetime_checkins", 4);
      return {
        // (lifetime >= X AND never attended) OR (lifetime >= X AND days > driftDays)
        combinator: "OR",
        conditions: [
          cond("attendance.lifetime_checkins", "gte", minLifetime, 1),
          cond("attendance.never_attended", "true", "", 1),
          cond("attendance.lifetime_checkins", "gte", minLifetime, 2),
          cond("attendance.last_service_days_ago", "gt", driftDays, 2),
        ],
      };
    }

    case "attendance_dropped":
      return {
        combinator: "AND",
        conditions: [
          cond("attendance.weeks_prior_12", "gte", n(p, "min_prior_weeks", 4)),
          cond("attendance.weeks_last_12_ratio_to_prior", "lte", 50),
        ],
      };

    case "in_group":
      return {
        combinator: "AND",
        conditions: [cond("group.is_in_group", "true", "")],
      };

    case "group_attendance_high":
      return {
        combinator: "AND",
        conditions: [
          cond("group.meetings_count", "gte", 3),
          cond("group.attendance_rate", "gte", 66),
        ],
      };

    case "group_attendance_mid":
      return {
        combinator: "AND",
        conditions: [
          cond("group.meetings_count", "gte", 3),
          cond("group.attendance_rate", "gte", 33),
          cond("group.attendance_rate", "lt", 66),
        ],
      };

    case "group_attendance_low":
      return {
        combinator: "AND",
        conditions: [
          cond("group.meetings_count", "gte", 4),
          cond("group.attendance_rate", "lt", 33),
        ],
      };

    case "group_inactive_30d": {
      const days = n(p, "days", 30);
      return {
        combinator: "AND",
        conditions: [
          cond("group.is_in_group", "true", ""),
          cond("group.never_attended", "true", "", 1),
          cond("group.last_attended_days_ago", "gt", days, 1),
        ],
      };
    }

    case "served_recently":
      return {
        combinator: "AND",
        conditions: [
          cond("serve.checkins_in_days", "gte", windowCount(n(p, "days", 30), 1)),
        ],
      };

    case "serves_regularly":
      return {
        combinator: "AND",
        conditions: [
          cond(
            "serve.checkins_in_days",
            "gte",
            windowCount(n(p, "days", 90), n(p, "min_times", 3))
          ),
        ],
      };

    case "stopped_serving": {
      const lookbackDays = n(p, "lookback_days", 180);
      const minTimes = n(p, "min_times", 3);
      const recentDays = n(p, "recent_days", 90);
      const quietDays = n(p, "quiet_days", 60);
      return {
        combinator: "AND",
        conditions: [
          cond("serve.checkins_in_days", "gte", windowCount(lookbackDays, minTimes)),
          cond("serve.checkins_in_days", "eq", windowCount(recentDays, 0)),
          cond("serve.never_served", "true", "", 1),
          cond("serve.days_since_last", "gt", quietDays, 1),
        ],
      };
    }

    case "in_active_flow":
      return {
        combinator: "AND",
        conditions: [cond("flow.in_any_flow", "true", "")],
      };

    case "stuck_in_stage_30d":
      return {
        combinator: "AND",
        conditions: [cond("flow.days_in_stage", "gte", n(p, "days", 30))],
      };

    case "flow_moment_recent":
      return {
        combinator: "AND",
        conditions: [
          cond("moment.any_recent_in_days", "gte", windowCount(n(p, "days", 90), 1)),
        ],
      };

    case "salvation_moment":
      return {
        combinator: "AND",
        conditions: [cond("moment.has_salvation", "true", "")],
      };

    case "watched_online_recent":
      return {
        combinator: "AND",
        conditions: [
          cond("online.watched_recent_in_days", "gte", windowCount(n(p, "days", 30), 1)),
        ],
      };

    case "prayer_request_submitted":
      return {
        combinator: "AND",
        conditions: [
          cond("online.prayer_recent_in_days", "gte", windowCount(n(p, "days", 90), 1)),
        ],
      };

    default:
      // Unknown built-ins fall back to a safe, always-false placeholder so the
      // user sees an empty rule instead of a misleading default.
      return {
        combinator: "AND",
        conditions: [cond("attendance.checkins_in_days", "gte", windowCount(30, 1))],
        note: "This built-in signal doesn't have a known starting rule yet.",
      };
  }
}

export function severityForPolarity(polarity: string): SignalSeverity {
  return polarity === "negative" ? "risk" : "info";
}

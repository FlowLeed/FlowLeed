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

const PARTIAL = "This built-in rule uses data the condition builder doesn't cover yet, so it starts from the closest match. Adjust or add conditions to make it your own.";

/** Closest condition-builder equivalent of each built-in signal, using the church's own numbers. */
export function markerLogicSeed(
  key: string,
  params?: Record<string, unknown> | null
): MarkerLogicSeed {
  const p = params || {};
  const one = (
    source: string,
    operator: string,
    value: any,
    note?: string
  ): MarkerLogicSeed => ({ combinator: "AND", conditions: [{ source, operator, value, condition_group: 0 }], note });

  switch (key) {
    case "attended_sunday_recent":
      return one("attendance.last_service_days_ago", "lte", n(p, "days", 14));
    case "consistent_attender":
      return one("attendance.services_last_n_weeks", "gte", n(p, "min_weeks", 3), PARTIAL);
    case "first_time_guest":
      return one("attendance.is_first_time_guest", "true", "");
    case "kids_checked_in":
      return one("attendance.last_service_days_ago", "lte", n(p, "days", 30), PARTIAL);
    case "missed_3_sundays":
      return {
        combinator: "AND",
        conditions: [
          { source: "attendance.last_service_days_ago", operator: "gte", value: n(p, "min_days", 21), condition_group: 0 },
          { source: "attendance.last_service_days_ago", operator: "lte", value: n(p, "max_days", 42), condition_group: 0 },
        ],
        note: PARTIAL,
      };
    case "drifting_6_weeks":
      return one("attendance.last_service_days_ago", "gte", n(p, "days", 42), PARTIAL);
    case "attendance_dropped":
      return one("attendance.services_last_n_weeks", "lte", n(p, "min_prior_weeks", 4), PARTIAL);
    case "in_group":
      return one("group.is_in_group", "true", "");
    case "group_attendance_high":
      return one("group.attendance_rate", "gte", 66);
    case "group_attendance_mid":
      return one("group.attendance_rate", "gte", 33, PARTIAL);
    case "group_attendance_low":
      return one("group.attendance_rate", "lte", 33);
    case "group_inactive_30d":
      return one("group.is_in_group", "true", "", PARTIAL);
    case "served_recently":
      return one("serve.days_since_last", "lte", n(p, "days", 30));
    case "serves_regularly":
      return one("serve.days_since_last", "lte", n(p, "days", 90), PARTIAL);
    case "stopped_serving":
      return one("serve.days_since_last", "gte", n(p, "recent_days", 90), PARTIAL);
    case "in_active_flow":
      return one("flow.in_any_flow", "true", "");
    case "stuck_in_stage_30d":
      return one("flow.days_in_stage", "gte", n(p, "days", 30));
    default:
      return one("attendance.last_service_days_ago", "lte", 30, PARTIAL);
  }
}

export function severityForPolarity(polarity: string): SignalSeverity {
  return polarity === "negative" ? "risk" : "info";
}

export type ConditionInputKind =
  | "number"
  | "days"
  | "text"
  | "none"
  | "campus"
  | "flow"
  | "stage"
  | "moment"
  | "moment_days"
  | "window_count";

export interface ConditionSource {
  value: string;
  label: string;
  category: string;
  operators: Array<{ value: string; label: string; input?: ConditionInputKind }>;
}

/** Available condition sources — shared with the edge-function evaluator. */
export const CONDITION_SOURCES: ConditionSource[] = [
  // Attendance
  {
    value: "attendance.last_service_days_ago",
    label: "Days since last service",
    category: "Attendance",
    operators: [
      { value: "lte", label: "is at most", input: "days" },
      { value: "gte", label: "is at least", input: "days" },
      { value: "gt", label: "is more than", input: "days" },
      { value: "lt", label: "is less than", input: "days" },
    ],
  },
  {
    value: "attendance.never_attended",
    label: "Never attended",
    category: "Attendance",
    operators: [{ value: "true", label: "is true", input: "none" }],
  },
  {
    value: "attendance.checkins_in_days",
    label: "Service check-ins in the last",
    category: "Attendance",
    operators: [
      { value: "gte", label: "is at least", input: "window_count" },
      { value: "eq", label: "equals", input: "window_count" },
    ],
  },
  {
    value: "attendance.distinct_weeks_in_window",
    label: "Distinct weeks attended in the last",
    category: "Attendance",
    operators: [{ value: "gte", label: "is at least", input: "window_count" }],
  },
  {
    value: "attendance.lifetime_checkins",
    label: "Lifetime check-ins",
    category: "Attendance",
    operators: [
      { value: "gte", label: "is at least", input: "number" },
      { value: "lt", label: "is less than", input: "number" },
    ],
  },
  {
    value: "attendance.first_seen_days_ago",
    label: "Days since first seen (first check-in or date added)",
    category: "Attendance",
    operators: [
      { value: "lte", label: "is at most", input: "days" },
      { value: "gte", label: "is at least", input: "days" },
    ],
  },
  {
    value: "attendance.guest_checkins_in_days",
    label: "Guest check-ins in the last",
    category: "Attendance",
    operators: [{ value: "gte", label: "is at least", input: "window_count" }],
  },
  {
    value: "attendance.household_checkins_in_days",
    label: "Kids check-ins in the last",
    category: "Attendance",
    operators: [{ value: "gte", label: "is at least", input: "window_count" }],
  },
  {
    value: "attendance.weeks_last_12",
    label: "Distinct weeks attended (last 12 weeks)",
    category: "Attendance",
    operators: [
      { value: "gte", label: "is at least", input: "number" },
      { value: "lte", label: "is at most", input: "number" },
    ],
  },
  {
    value: "attendance.weeks_prior_12",
    label: "Distinct weeks attended (prior 12 weeks)",
    category: "Attendance",
    operators: [
      { value: "gte", label: "is at least", input: "number" },
      { value: "lte", label: "is at most", input: "number" },
    ],
  },
  {
    value: "attendance.weeks_last_12_ratio_to_prior",
    label: "Last-12-week attendance vs prior 12 weeks",
    category: "Attendance",
    operators: [
      { value: "lte", label: "is at most (%)", input: "number" },
      { value: "gte", label: "is at least (%)", input: "number" },
    ],
  },
  // Campus
  {
    value: "campus.assignment",
    label: "Campus",
    category: "Campus",
    operators: [
      { value: "eq", label: "is", input: "campus" },
      { value: "neq", label: "is not", input: "campus" },
      { value: "unassigned", label: "is not assigned", input: "none" },
    ],
  },
  // Flows
  {
    value: "flow.in_flow",
    label: "Is in Flow",
    category: "Flows",
    operators: [
      { value: "eq", label: "equals", input: "flow" },
      { value: "neq", label: "does not equal", input: "flow" },
    ],
  },
  {
    value: "flow.in_stage",
    label: "Is in Flow stage",
    category: "Flows",
    operators: [{ value: "eq", label: "equals", input: "stage" }],
  },
  {
    value: "flow.in_any_flow",
    label: "Is in any active Flow",
    category: "Flows",
    operators: [
      { value: "true", label: "yes", input: "none" },
      { value: "false", label: "no", input: "none" },
    ],
  },
  {
    value: "flow.days_in_stage",
    label: "Days in current Flow stage",
    category: "Flows",
    operators: [
      { value: "gte", label: "is at least", input: "days" },
      { value: "lte", label: "is at most", input: "days" },
    ],
  },
  // Groups
  {
    value: "group.is_in_group",
    label: "Is in a group",
    category: "Groups",
    operators: [
      { value: "true", label: "yes", input: "none" },
      { value: "false", label: "no", input: "none" },
    ],
  },
  {
    value: "group.never_attended",
    label: "Never attended a group meeting",
    category: "Groups",
    operators: [{ value: "true", label: "is true", input: "none" }],
  },
  {
    value: "group.last_attended_days_ago",
    label: "Days since last group attendance",
    category: "Groups",
    operators: [
      { value: "gte", label: "is at least", input: "days" },
      { value: "lte", label: "is at most", input: "days" },
      { value: "gt", label: "is more than", input: "days" },
    ],
  },
  {
    value: "group.meetings_count",
    label: "Recent group meetings available",
    category: "Groups",
    operators: [
      { value: "gte", label: "is at least", input: "number" },
      { value: "lte", label: "is at most", input: "number" },
    ],
  },
  {
    value: "group.attendance_rate",
    label: "Group attendance rate",
    category: "Groups",
    operators: [
      { value: "gte", label: "is at least (%)", input: "number" },
      { value: "lte", label: "is at most (%)", input: "number" },
      { value: "gt", label: "is more than (%)", input: "number" },
      { value: "lt", label: "is less than (%)", input: "number" },
    ],
  },
  // Serving
  {
    value: "serve.days_since_last",
    label: "Days since last serve",
    category: "Serving",
    operators: [
      { value: "lte", label: "is at most", input: "days" },
      { value: "gte", label: "is at least", input: "days" },
      { value: "gt", label: "is more than", input: "days" },
    ],
  },
  {
    value: "serve.never_served",
    label: "Never served",
    category: "Serving",
    operators: [{ value: "true", label: "is true", input: "none" }],
  },
  {
    value: "serve.checkins_in_days",
    label: "Volunteer check-ins in the last",
    category: "Serving",
    operators: [
      { value: "gte", label: "is at least", input: "window_count" },
      { value: "eq", label: "equals", input: "window_count" },
    ],
  },
  // Flow Moments
  {
    value: "moment.has_type",
    label: "Flow Moment",
    category: "Flow Moments",
    operators: [
      { value: "has", label: "has", input: "moment" },
      { value: "not_has", label: "does not have", input: "moment" },
    ],
  },
  {
    value: "moment.days_since_type",
    label: "Days since Flow Moment",
    category: "Flow Moments",
    operators: [
      { value: "lte", label: "is at most", input: "moment_days" },
      { value: "gte", label: "is at least", input: "moment_days" },
    ],
  },
  {
    value: "moment.any_recent_in_days",
    label: "Any Flow Moment in the last",
    category: "Flow Moments",
    operators: [{ value: "gte", label: "is at least", input: "window_count" }],
  },
  {
    value: "moment.has_salvation",
    label: "Has salvation decision recorded",
    category: "Flow Moments",
    operators: [{ value: "true", label: "is true", input: "none" }],
  },
  // Church Online
  {
    value: "online.watched_recent_in_days",
    label: "Online events watched in the last",
    category: "Church Online",
    operators: [{ value: "gte", label: "is at least", input: "window_count" }],
  },
  {
    value: "online.prayer_recent_in_days",
    label: "Prayer requests submitted in the last",
    category: "Church Online",
    operators: [{ value: "gte", label: "is at least", input: "window_count" }],
  },
  // Tags
  {
    value: "tag.has",
    label: "Has tag",
    category: "Tags",
    operators: [{ value: "eq", label: "equals", input: "text" }],
  },
  {
    value: "tag.not_has",
    label: "Does not have tag",
    category: "Tags",
    operators: [{ value: "eq", label: "equals", input: "text" }],
  },
];

export function findSource(value: string): ConditionSource {
  return CONDITION_SOURCES.find((s) => s.value === value) || CONDITION_SOURCES[0];
}

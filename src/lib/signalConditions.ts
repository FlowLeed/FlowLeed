export type ConditionInputKind = "number" | "days" | "text" | "none";

export interface ConditionSource {
  value: string;
  label: string;
  category: string;
  operators: Array<{ value: string; label: string; input?: ConditionInputKind }>;
}

/** Available condition sources — shared with the edge-function evaluator. */
export const CONDITION_SOURCES: ConditionSource[] = [
  {
    value: "attendance.last_service_days_ago",
    label: "Days since last service",
    category: "Attendance",
    operators: [
      { value: "lte", label: "is at most", input: "days" },
      { value: "gte", label: "is at least", input: "days" },
    ],
  },
  {
    value: "attendance.services_last_n_weeks",
    label: "Services attended (last 12w)",
    category: "Attendance",
    operators: [
      { value: "gte", label: "is at least", input: "number" },
      { value: "lte", label: "is at most", input: "number" },
    ],
  },
  {
    value: "attendance.is_first_time_guest",
    label: "First-time guest (last 30d)",
    category: "Attendance",
    operators: [{ value: "true", label: "is true", input: "none" }],
  },
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
    value: "group.attendance_rate",
    label: "Group attendance rate",
    category: "Groups",
    operators: [
      { value: "gte", label: "is at least (%)", input: "number" },
      { value: "lte", label: "is at most (%)", input: "number" },
    ],
  },
  {
    value: "serve.days_since_last",
    label: "Days since last serve",
    category: "Serving",
    operators: [
      { value: "lte", label: "is at most", input: "days" },
      { value: "gte", label: "is at least", input: "days" },
    ],
  },
  {
    value: "flow.in_any_flow",
    label: "Is in any active flow",
    category: "Flows",
    operators: [
      { value: "true", label: "yes", input: "none" },
      { value: "false", label: "no", input: "none" },
    ],
  },
  {
    value: "flow.days_in_stage",
    label: "Days in current stage",
    category: "Flows",
    operators: [
      { value: "gte", label: "is at least", input: "days" },
      { value: "lte", label: "is at most", input: "days" },
    ],
  },
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

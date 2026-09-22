export type EngagementLevelKey = "highly_engaged" | "active" | "at_risk" | "inactive" | "new";

export type EngagementWeights = {
  consistency: number;
  recency: number;
  group_attendance: number;
  streak: number;
  serving: number;
  leadership: number;
  group_membership: number;
  flow_moments: number;
  notes_interactions: number;
  form_submissions: number;
  event_attendance: number;
  giving: number;
};

export type EngagementWindows = {
  consistency_weeks: number;
  recency_days: number;
  serving_days: number;
  activity_days: number;
};

export type EngagementThresholds = {
  highly_engaged: number;
  active: number;
  at_risk: number;
  new_max_checkins: number;
};

export type EngagementIngredients = {
  service_checkins: boolean;
  group_attendance: boolean;
  serving: boolean;
  leadership: boolean;
  group_membership: boolean;
  flow_moments: boolean;
  notes_interactions: boolean;
  form_submissions: boolean;
  event_attendance: boolean;
  giving: boolean;
};

export type EngagementLabels = Record<EngagementLevelKey, string>;

export type EngagementSafeguards = {
  serving_keeps_active: boolean;
  recent_attendance_days: number;
  household_credit: boolean;
  streak_break_misses: number;
  count_partial_week: boolean;
};

export type EngagementSettings = {
  preset_key: string;
  weights: EngagementWeights;
  windows: EngagementWindows;
  thresholds: EngagementThresholds;
  ingredients: EngagementIngredients;
  labels: EngagementLabels;
  safeguards: EngagementSafeguards;
};

export const DEFAULT_LABELS: EngagementLabels = {
  highly_engaged: "Highly Engaged",
  active: "Active",
  at_risk: "At Risk",
  inactive: "Inactive",
  new: "New",
};

const ZERO_EXTRAS = {
  group_attendance: 0,
  group_membership: 0,
  flow_moments: 0,
  notes_interactions: 0,
  form_submissions: 0,
  event_attendance: 0,
  giving: 0,
};

export const DEFAULT_ENGAGEMENT_SETTINGS: EngagementSettings = {
  preset_key: "balanced",
  weights: { consistency: 35, recency: 20, streak: 15, serving: 20, leadership: 10, ...ZERO_EXTRAS },
  windows: { consistency_weeks: 12, recency_days: 90, serving_days: 90, activity_days: 90 },
  thresholds: { highly_engaged: 75, active: 50, at_risk: 25, new_max_checkins: 3 },
  ingredients: {
    service_checkins: true,
    group_attendance: true,
    serving: true,
    leadership: true,
    group_membership: false,
    flow_moments: false,
    notes_interactions: false,
    form_submissions: false,
    event_attendance: false,
    giving: false,
  },
  labels: { ...DEFAULT_LABELS },
  safeguards: {
    serving_keeps_active: true,
    recent_attendance_days: 14,
    household_credit: true,
    streak_break_misses: 1,
    count_partial_week: false,
  },
};

export type EngagementPreset = {
  key: string;
  label: string;
  description: string;
  settings: Omit<EngagementSettings, "preset_key" | "labels">;
};

const base = DEFAULT_ENGAGEMENT_SETTINGS;

export const ENGAGEMENT_PRESETS: EngagementPreset[] = [
  {
    key: "balanced",
    label: "Balanced",
    description: "Attendance, serving and leadership all matter. This is how FlowLeed scores by default.",
    settings: {
      weights: base.weights,
      windows: base.windows,
      thresholds: base.thresholds,
      ingredients: base.ingredients,
      safeguards: base.safeguards,
    },
  },
  {
    key: "attendance",
    label: "Attendance-focused",
    description: "Showing up consistently and recently carries most of the score.",
    settings: {
      weights: { consistency: 45, recency: 30, streak: 15, serving: 7, leadership: 3, ...ZERO_EXTRAS },
      windows: base.windows,
      thresholds: base.thresholds,
      ingredients: base.ingredients,
      safeguards: { ...base.safeguards, serving_keeps_active: false },
    },
  },
  {
    key: "serving",
    label: "Serving-focused",
    description: "Serving on a team and leading others carry the most weight.",
    settings: {
      weights: { consistency: 20, recency: 15, streak: 10, serving: 35, leadership: 20, ...ZERO_EXTRAS },
      windows: base.windows,
      thresholds: base.thresholds,
      ingredients: base.ingredients,
      safeguards: base.safeguards,
    },
  },
  {
    key: "groups",
    label: "Small-group-focused",
    description: "Group attendance and being in an active group carry the most weight.",
    settings: {
      weights: {
        consistency: 15,
        recency: 10,
        group_attendance: 20,
        streak: 5,
        serving: 10,
        leadership: 10,
        ...ZERO_EXTRAS,
        group_membership: 30,
      },
      windows: base.windows,
      thresholds: base.thresholds,
      ingredients: { ...base.ingredients, group_membership: true },
      safeguards: base.safeguards,
    },
  },
];

export type IngredientKey = keyof EngagementIngredients;

export type IngredientMeta = {
  key: IngredientKey;
  weightKey: keyof EngagementWeights | null;
  label: string;
  description: string;
  requiresIntegration?: string;
};

export const ENGAGEMENT_INGREDIENTS: IngredientMeta[] = [
  {
    key: "service_checkins",
    weightKey: "consistency",
    label: "Service check-ins",
    description: "Weekend and midweek service check-ins from Planning Center.",
  },
  {
    key: "group_attendance",
    weightKey: "group_attendance",
    label: "Group attendance",
    description: "Recent attendance recorded at group meetings, separate from service check-ins.",
  },
  {
    key: "serving",
    weightKey: "serving",
    label: "Serving and volunteering",
    description: "Volunteer check-ins and serving moments in the serving window.",
  },
  {
    key: "leadership",
    weightKey: "leadership",
    label: "Leadership roles",
    description: "Leading, co-leading or hosting an active group.",
  },
  {
    key: "group_membership",
    weightKey: "group_membership",
    label: "Active group membership",
    description: "Being a member of an active group, even without attendance records.",
  },
  {
    key: "flow_moments",
    weightKey: "flow_moments",
    label: "Flow Moments",
    description: "Milestones such as baptism, salvation or next steps in the activity window.",
  },
  {
    key: "notes_interactions",
    weightKey: "notes_interactions",
    label: "Notes and interactions",
    description: "Calls, visits, texts and notes your team logged in the activity window.",
  },
  {
    key: "form_submissions",
    weightKey: "form_submissions",
    label: "Form submissions",
    description: "Forms the person filled out in the activity window.",
  },
  {
    key: "event_attendance",
    weightKey: "event_attendance",
    label: "Online events",
    description: "Online service responses such as prayer or salvation in the activity window.",
  },
  {
    key: "giving",
    weightKey: "giving",
    label: "Giving",
    description: "Generosity as a sign of engagement.",
    requiresIntegration: "A giving source is not connected yet, so this cannot be turned on.",
  },
];

export const LEVEL_ORDER: EngagementLevelKey[] = ["highly_engaged", "active", "at_risk", "inactive", "new"];

export function mergeEngagementSettings(row: Partial<EngagementSettings> | null | undefined): EngagementSettings {
  if (!row) return { ...DEFAULT_ENGAGEMENT_SETTINGS };
  return {
    preset_key: row.preset_key ?? DEFAULT_ENGAGEMENT_SETTINGS.preset_key,
    weights: { ...DEFAULT_ENGAGEMENT_SETTINGS.weights, ...(row.weights ?? {}) },
    windows: { ...DEFAULT_ENGAGEMENT_SETTINGS.windows, ...(row.windows ?? {}) },
    thresholds: { ...DEFAULT_ENGAGEMENT_SETTINGS.thresholds, ...(row.thresholds ?? {}) },
    ingredients: { ...DEFAULT_ENGAGEMENT_SETTINGS.ingredients, ...(row.ingredients ?? {}) },
    labels: { ...DEFAULT_LABELS, ...(row.labels ?? {}) },
    safeguards: { ...DEFAULT_ENGAGEMENT_SETTINGS.safeguards, ...(row.safeguards ?? {}) },
  };
}

export function presetSettings(key: string): EngagementSettings {
  const preset = ENGAGEMENT_PRESETS.find((p) => p.key === key);
  if (!preset) return { ...DEFAULT_ENGAGEMENT_SETTINGS };
  return {
    preset_key: preset.key,
    labels: { ...DEFAULT_LABELS },
    weights: { ...preset.settings.weights },
    windows: { ...preset.settings.windows },
    thresholds: { ...preset.settings.thresholds },
    ingredients: { ...preset.settings.ingredients },
    safeguards: { ...preset.settings.safeguards },
  };
}

/** Sum of the weights that actually count, given which ingredients are on. */
export function activeWeightTotal(settings: EngagementSettings): number {
  const { weights, ingredients } = settings;
  let total = 0;
  if (ingredients.service_checkins) {
    total += weights.consistency + weights.recency + weights.streak;
  }
  if (ingredients.group_attendance) total += weights.group_attendance;
  if (ingredients.serving) total += weights.serving;
  if (ingredients.leadership) total += weights.leadership;
  if (ingredients.group_membership) total += weights.group_membership;
  if (ingredients.flow_moments) total += weights.flow_moments;
  if (ingredients.notes_interactions) total += weights.notes_interactions;
  if (ingredients.form_submissions) total += weights.form_submissions;
  if (ingredients.event_attendance) total += weights.event_attendance;
  if (ingredients.giving) total += weights.giving;
  return total;
}

export const BREAKDOWN_LABELS: Record<string, string> = {
  consistency: "Consistency",
  recency: "Recency",
  streak: "Streak",
  group_attendance: "Group attendance",
  serving: "Serving",
  leadership: "Leadership",
  group_membership: "Group membership",
  flow_moments: "Flow Moments",
  notes_interactions: "Notes & interactions",
  form_submissions: "Forms",
  event_attendance: "Online events",
  giving: "Giving",
};

export type ScoreBreakdown = Record<string, { earned: number; max: number } | number>;

export function breakdownParts(breakdown: ScoreBreakdown | null | undefined) {
  if (!breakdown) return [] as { key: string; label: string; earned: number; max: number }[];
  return Object.entries(breakdown)
    .filter(([key, value]) => key !== "total_weight" && value && typeof value === "object")
    .map(([key, value]) => {
      const v = value as { earned: number; max: number };
      return { key, label: BREAKDOWN_LABELS[key] ?? key, earned: Number(v.earned ?? 0), max: Number(v.max ?? 0) };
    })
    .filter((part) => part.max > 0);
}

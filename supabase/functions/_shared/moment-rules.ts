// Shared moment rule evaluator for PCO custom-tab-field mappings.
// A "rule" is one flow_moment_type_id with multiple pco_moment_mappings rows,
// combined by `rule_combinator` at the top level and the opposite inside
// non-zero `condition_group`s.

export interface Mapping {
  id: string;
  pco_source_identifier: string;
  pco_source_label: string;
  pco_tab_name?: string | null;
  flow_moment_type_id: string;
  trigger_condition: { operator: string; value: string | null } | null;
  rule_combinator: 'AND' | 'OR';
  condition_group: number;
  flow_moment_types?: { name?: string } | null;
}

export interface FieldValueEntry {
  value: any;
  created_at?: string;
  updated_at?: string;
}

const isTruthyValue = (val: any): boolean => {
  if (val === null || val === undefined) return false;
  const s = String(val).toLowerCase().trim();
  return ['true', 'yes', '1', 'checked', 'on'].includes(s);
};

export function evaluateCondition(
  operator: string,
  expected: string | null,
  actual: any
): boolean {
  switch (operator) {
    case 'is_truthy':
      return isTruthyValue(actual);
    case 'is_falsy':
      return actual !== null && actual !== undefined && String(actual).trim() !== '' && !isTruthyValue(actual);
    case 'is_empty':
      return actual === null || actual === undefined || String(actual).trim() === '';
    case 'is_not_empty':
    case 'has_any_value':
      return actual !== null && actual !== undefined && String(actual).trim() !== '';
    case 'equals':
      return String(actual ?? '').toLowerCase() === String(expected ?? '').toLowerCase();
    case 'not_equals':
      return String(actual ?? '').toLowerCase() !== String(expected ?? '').toLowerCase();
    case 'contains':
      return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    case 'is_true':
    case 'is_checked':
      return isTruthyValue(actual);
    default:
      return false;
  }
}

export interface RuleEvaluation {
  matched: boolean;
  matchedConditions: Array<{
    field_id: string;
    field_label: string;
    value: any;
    updated_at?: string;
  }>;
  latestTimestamp?: string;
}

export function groupMappingsByMoment(mappings: Mapping[]): Map<string, Mapping[]> {
  const map = new Map<string, Mapping[]>();
  for (const m of mappings) {
    const list = map.get(m.flow_moment_type_id) ?? [];
    list.push(m);
    map.set(m.flow_moment_type_id, list);
  }
  return map;
}

/**
 * Evaluate a single moment rule against a person's field-data map.
 * fieldDataMap: pco field_definition id -> { value, created_at, updated_at }
 */
export function evaluateRule(
  mappings: Mapping[],
  fieldDataMap: Map<string, FieldValueEntry>
): RuleEvaluation {
  if (mappings.length === 0) {
    return { matched: false, matchedConditions: [] };
  }
  const combinator: 'AND' | 'OR' = mappings[0].rule_combinator ?? 'AND';

  // Bucket conditions by group
  const groups = new Map<number, Mapping[]>();
  for (const m of mappings) {
    const g = m.condition_group ?? 0;
    const arr = groups.get(g) ?? [];
    arr.push(m);
    groups.set(g, arr);
  }

  const matchedConditions: RuleEvaluation['matchedConditions'] = [];

  const evalMapping = (m: Mapping): boolean => {
    const fd = fieldDataMap.get(m.pco_source_identifier);
    const actual = fd?.value;
    const cond = m.trigger_condition || { operator: 'is_not_empty', value: null };
    const ok = evaluateCondition(cond.operator, cond.value ?? null, actual);
    if (ok) {
      matchedConditions.push({
        field_id: m.pco_source_identifier,
        field_label: m.pco_source_label,
        value: actual,
        updated_at: fd?.updated_at,
      });
    }
    return ok;
  };

  // Reduce a list with a given combinator (AND/OR)
  const reduce = (items: boolean[], op: 'AND' | 'OR'): boolean => {
    if (items.length === 0) return op === 'AND'; // empty AND = true, empty OR = false
    return op === 'AND' ? items.every(Boolean) : items.some(Boolean);
  };

  // Top-level items: each mapping in group 0 + each non-zero group treated as one item
  // Inside a non-zero group, conditions combine with the OPPOSITE combinator.
  const innerCombinator: 'AND' | 'OR' = combinator === 'AND' ? 'OR' : 'AND';

  const topResults: boolean[] = [];

  const zeroGroup = groups.get(0) ?? [];
  for (const m of zeroGroup) {
    topResults.push(evalMapping(m));
  }

  for (const [gid, list] of groups) {
    if (gid === 0) continue;
    const inner = list.map(evalMapping);
    topResults.push(reduce(inner, innerCombinator));
  }

  const matched = reduce(topResults, combinator);

  let latestTimestamp: string | undefined;
  if (matched && matchedConditions.length > 0) {
    latestTimestamp = matchedConditions
      .map((c) => c.updated_at)
      .filter(Boolean)
      .sort()
      .pop() as string | undefined;
  }

  return { matched, matchedConditions, latestTimestamp };
}

// Try to parse date-like strings ("MM/DD/YYYY", "YYYY-MM-DD...") to ISO
export function parsePcoDateValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [m, d, y] = s.split('/');
    const dt = new Date(`${y}-${m}-${d}`);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  return null;
}

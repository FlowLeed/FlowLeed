// Evaluate custom signals for an org: match contacts against rules and
// upsert results into custom_signal_contacts (setting cleared_at when a
// contact no longer matches).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Condition {
  source: string;
  operator: string;
  value: any;
  condition_group?: number;
}

type ContactFacts = {
  contact_id: string;
  campus_id: string | null;
  last_service_days_ago: number | null;
  services_last_12w: number;
  is_first_time_guest: boolean;
  is_in_group: boolean;
  group_attendance_rate: number | null; // 0-100
  days_since_last_serve: number | null;
  in_any_flow: boolean;
  active_flow_ids: Set<string>;
  active_stage_ids: Set<string>;
  days_in_stage: number | null;
  moment_days_by_type: Map<string, number>;
  tags: Set<string>;
};

function daysBetween(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function evalCond(c: Condition, f: ContactFacts): boolean {
  const num = (v: any) => Number(v);
  switch (c.source) {
    case "campus.assignment":
      if (c.operator === "unassigned") return f.campus_id === null;
      if (c.operator === "neq") return f.campus_id !== null && f.campus_id !== String(c.value || "");
      return f.campus_id === String(c.value || "");
    case "attendance.last_service_days_ago": {
      if (f.last_service_days_ago === null) return false;
      return c.operator === "lte"
        ? f.last_service_days_ago <= num(c.value)
        : f.last_service_days_ago >= num(c.value);
    }
    case "attendance.services_last_n_weeks":
      return c.operator === "gte"
        ? f.services_last_12w >= num(c.value)
        : f.services_last_12w <= num(c.value);
    case "attendance.is_first_time_guest":
      return f.is_first_time_guest;
    case "group.is_in_group":
      return c.operator === "true" ? f.is_in_group : !f.is_in_group;
    case "group.attendance_rate": {
      if (f.group_attendance_rate === null) return false;
      return c.operator === "gte"
        ? f.group_attendance_rate >= num(c.value)
        : f.group_attendance_rate <= num(c.value);
    }
    case "serve.days_since_last": {
      if (f.days_since_last_serve === null) return false;
      return c.operator === "lte"
        ? f.days_since_last_serve <= num(c.value)
        : f.days_since_last_serve >= num(c.value);
    }
    case "flow.in_any_flow":
      return c.operator === "true" ? f.in_any_flow : !f.in_any_flow;
    case "flow.in_flow": {
      const hasFlow = f.active_flow_ids.has(String(c.value || ""));
      return c.operator === "neq" ? !hasFlow : hasFlow;
    }
    case "flow.in_stage":
      return f.active_stage_ids.has(String(c.value || ""));
    case "flow.days_in_stage": {
      if (f.days_in_stage === null) return false;
      return c.operator === "gte"
        ? f.days_in_stage >= num(c.value)
        : f.days_in_stage <= num(c.value);
    }
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
      return c.operator === "lte" ? days <= num(value.days) : days >= num(value.days);
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
  sb: ReturnType<typeof createClient>,
  orgId: string,
): Promise<Map<string, ContactFacts>> {
  const now = Date.now();
  const facts = new Map<string, ContactFacts>();

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
      is_first_time_guest: false,
      is_in_group: false,
      group_attendance_rate: null,
      days_since_last_serve: null,
      in_any_flow: false,
      active_flow_ids: new Set(),
      active_stage_ids: new Set(),
      days_in_stage: null,
      moment_days_by_type: new Map(),
      tags: new Set(),
    });
  }

  // Check-ins (service attendance) — last 12 weeks
  const twelveWks = new Date(now - 84 * 86400000).toISOString();
  const { data: checkins } = await sb
    .from("pco_checkins")
    .select("contact_id, checked_in_at, checkin_kind")
    .eq("organization_id", orgId)
    .gte("checked_in_at", twelveWks)
    .limit(100000);
  const firstSeen = new Map<string, string>();
  for (const ci of checkins || []) {
    const cid = (ci as any).contact_id as string;
    if (!cid) continue;
    const f = facts.get(cid);
    if (!f) continue;
    const at = (ci as any).checked_in_at as string;
    f.services_last_12w += 1;
    const days = daysBetween(at);
    if (days !== null && (f.last_service_days_ago === null || days < f.last_service_days_ago)) {
      f.last_service_days_ago = days;
    }
    const prev = firstSeen.get(cid);
    if (!prev || at < prev) firstSeen.set(cid, at);
  }
  // First-time guest = only one checkin, in the last 30 days
  for (const [cid, f] of facts) {
    if (f.services_last_12w === 1) {
      const first = firstSeen.get(cid);
      const d = daysBetween(first ?? null);
      if (d !== null && d <= 30) f.is_first_time_guest = true;
    }
  }

  // Groups
  const { data: gm } = await sb
    .from("group_members")
    .select("contact_id, attendance_count, joined_at, status")
    .limit(100000);
  const groupJoin = new Map<string, string>();
  for (const m of gm || []) {
    const cid = (m as any).contact_id;
    const f = facts.get(cid);
    if (!f) continue;
    if ((m as any).status !== "inactive") f.is_in_group = true;
    if ((m as any).joined_at) groupJoin.set(cid, (m as any).joined_at);
  }
  // Group attendance rate — attended / meetings since joined
  const { data: ga } = await sb
    .from("group_attendance")
    .select("contact_id, status, checked_in_at")
    .limit(200000);
  const attStats = new Map<string, { present: number; total: number }>();
  for (const a of ga || []) {
    const cid = (a as any).contact_id;
    if (!cid || !facts.has(cid)) continue;
    const s = attStats.get(cid) ?? { present: 0, total: 0 };
    s.total += 1;
    if ((a as any).status === "present") s.present += 1;
    attStats.set(cid, s);
  }
  for (const [cid, s] of attStats) {
    const f = facts.get(cid);
    if (f && s.total > 0) f.group_attendance_rate = Math.round((s.present / s.total) * 100);
  }

  // Serving — treat check-ins with kind=Regular volunteer as serving
  const { data: serves } = await sb
    .from("pco_checkins")
    .select("contact_id, checked_in_at, checkin_kind")
    .eq("organization_id", orgId)
    .ilike("checkin_kind", "%volunteer%")
    .order("checked_in_at", { ascending: false })
    .limit(50000);
  const lastServe = new Map<string, string>();
  for (const s of serves || []) {
    const cid = (s as any).contact_id;
    if (!cid) continue;
    if (!lastServe.has(cid)) lastServe.set(cid, (s as any).checked_in_at);
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

  // Flow Moments — retain the latest occurrence for each active moment type.
  const { data: momentTypes } = await sb
    .from("flow_moment_types")
    .select("id")
    .eq("organization_id", orgId)
    .eq("is_active", true);
  const momentTypeIds = (momentTypes || []).map((type: any) => type.id as string);
  const { data: moments } = momentTypeIds.length
    ? await sb
      .from("flow_moments")
      .select("contact_id, flow_moment_type_id, occurred_at")
      .in("flow_moment_type_id", momentTypeIds)
      .order("occurred_at", { ascending: false })
      .limit(100000)
    : { data: [] };
  for (const moment of moments || []) {
    const f = facts.get((moment as any).contact_id);
    if (!f) continue;
    const typeId = (moment as any).flow_moment_type_id as string;
    const days = daysBetween((moment as any).occurred_at);
    if (days === null) continue;
    const previous = f.moment_days_by_type.get(typeId);
    if (previous === undefined || days < previous) f.moment_days_by_type.set(typeId, days);
  }

  // Tags
  const { data: tags } = await sb
    .from("contact_tags")
    .select("contact_id, tag")
    .limit(200000);
  for (const t of tags || []) {
    const f = facts.get((t as any).contact_id);
    if (f) f.tags.add(String((t as any).tag || "").toLowerCase());
  }

  return facts;
}

async function evaluateOrg(sb: ReturnType<typeof createClient>, orgId: string) {
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

  const facts = await loadFacts(sb, orgId);

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
      await sb.from("custom_signal_contacts").insert(toInsert);
    }
    if (toReopen.length) {
      await sb
        .from("custom_signal_contacts")
        .update({ matched_at: now, cleared_at: null })
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
        .update({ cleared_at: now })
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

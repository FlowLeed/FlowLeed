// Signal Agent — reviews watched signals and drops suggestions into the
// signal_agent_suggestions queue. Never executes actions itself.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

interface Candidate {
  contact_id: string;
  contact_name: string;
  signal_key: string;
  signal_source: "builtin" | "custom";
  signal_label: string;
  reason: string;
  assignee_user_id: string | null;
}

async function collectCandidates(
  sb: ReturnType<typeof createClient>,
  orgId: string,
  watchSignals: string[],
  maxPerRun: number,
): Promise<Candidate[]> {
  const out: Candidate[] = [];
  if (!watchSignals.length) return out;

  const builtin = watchSignals.filter((k) => !k.startsWith("custom:"));
  const customIds = watchSignals
    .filter((k) => k.startsWith("custom:"))
    .map((k) => k.slice("custom:".length));

  // Built-in markers via contact_markers
  if (builtin.length) {
    const { data } = await sb
      .from("contact_markers")
      .select("contact_id, marker_key, computed_at, contacts:contact_id(name, assigned_to_user_id)")
      .eq("organization_id", orgId)
      .in("marker_key", builtin)
      .order("computed_at", { ascending: false })
      .limit(maxPerRun * 3);
    for (const m of (data || []) as any[]) {
      out.push({
        contact_id: m.contact_id,
        contact_name: m.contacts?.name || "Unknown",
        signal_key: m.marker_key,
        signal_source: "builtin",
        signal_label: m.marker_key,
        reason: `Marker ${m.marker_key} triggered ${m.computed_at}`,
        assignee_user_id: m.contacts?.assigned_to_user_id || null,
      });
    }
  }

  // Custom signals via custom_signal_contacts
  if (customIds.length) {
    const { data: sigs } = await sb
      .from("custom_signals")
      .select("id, key, label")
      .in("id", customIds);
    const byId = new Map<string, any>();
    for (const s of sigs || []) byId.set((s as any).id, s);

    const { data } = await sb
      .from("custom_signal_contacts")
      .select("signal_id, contact_id, matched_at, contacts:contact_id(name, assigned_to_user_id)")
      .in("signal_id", customIds)
      .is("cleared_at", null)
      .order("matched_at", { ascending: false })
      .limit(maxPerRun * 3);
    for (const m of (data || []) as any[]) {
      const sig = byId.get(m.signal_id);
      if (!sig) continue;
      out.push({
        contact_id: m.contact_id,
        contact_name: m.contacts?.name || "Unknown",
        signal_key: `custom:${m.signal_id}`,
        signal_source: "custom",
        signal_label: sig.label,
        reason: `Custom signal "${sig.label}" matched ${m.matched_at}`,
        assignee_user_id: m.contacts?.assigned_to_user_id || null,
      });
    }
  }

  return out.slice(0, maxPerRun);
}

async function alreadySuggested(
  sb: ReturnType<typeof createClient>,
  orgId: string,
  contactId: string,
  signalKey: string,
): Promise<boolean> {
  const sevenDays = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data } = await sb
    .from("signal_agent_suggestions")
    .select("id, status")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .eq("signal_key", signalKey)
    .gte("created_at", sevenDays)
    .limit(1);
  return !!(data && data.length);
}

async function askAgent(
  candidates: Candidate[],
  allowedActions: string[],
  apiKey: string,
): Promise<any[]> {
  const system = `You are a pastoral care AI copilot. For each contact + signal, propose ONE concrete follow-up action a pastor should approve. You may only suggest actions from this list: ${allowedActions.join(", ")}. Never invent contact details. Keep reasoning under 2 sentences. Confidence is 0-1.`;

  const user = `Suggest actions for these contacts:\n\n${
    candidates
      .map(
        (c, i) =>
          `${i + 1}. Contact: ${c.contact_name} (id: ${c.contact_id})\n   Signal: ${c.signal_label}\n   Reason: ${c.reason}`,
      )
      .join("\n\n")
  }\n\nRespond as JSON: { "suggestions": [{ "index": 1, "action_type": "notify|add_to_flow|create_task|draft_message", "action_payload": { ... }, "reasoning": "...", "confidence": 0.8 }] }. Include one entry per contact you want to act on; skip contacts where no action is warranted.`;

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 400)}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  } catch {
    return [];
  }
}

async function runForOrg(sb: ReturnType<typeof createClient>, orgId: string, apiKey: string) {
  const { data: cfg } = await sb
    .from("signal_agent_configs")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!cfg || !(cfg as any).enabled) return { skipped: "disabled" };

  const watch = ((cfg as any).watch_signals || []) as string[];
  const allowed = ((cfg as any).allowed_actions || ["notify"]) as string[];
  const cap = (cfg as any).max_suggestions_per_day || 20;

  // How many were already emitted today?
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: emittedToday } = await sb
    .from("signal_agent_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", startOfDay.toISOString());
  const budget = Math.max(0, cap - (emittedToday || 0));
  if (budget <= 0) return { skipped: "daily_cap_reached" };

  const candidates = await collectCandidates(sb, orgId, watch, Math.min(budget * 2, 50));
  if (!candidates.length) return { candidates: 0, suggestions: 0 };

  // Dedupe against recent suggestions
  const fresh: Candidate[] = [];
  for (const c of candidates) {
    if (fresh.length >= budget) break;
    if (await alreadySuggested(sb, orgId, c.contact_id, c.signal_key)) continue;
    fresh.push(c);
  }
  if (!fresh.length) return { candidates: candidates.length, suggestions: 0, note: "all_deduped" };

  // Batches of 15
  const inserted: any[] = [];
  for (let i = 0; i < fresh.length; i += 15) {
    const batch = fresh.slice(i, i + 15);
    let suggestions: any[] = [];
    try {
      suggestions = await askAgent(batch, allowed, apiKey);
    } catch (e) {
      console.error("agent call failed", e);
      continue;
    }
    for (const s of suggestions) {
      const idx = Number(s.index) - 1;
      const cand = batch[idx];
      if (!cand) continue;
      if (!allowed.includes(s.action_type)) continue;
      inserted.push({
        organization_id: orgId,
        contact_id: cand.contact_id,
        signal_key: cand.signal_key,
        signal_source: cand.signal_source,
        action_type: s.action_type,
        action_payload: s.action_payload || {},
        reasoning: String(s.reasoning || "").slice(0, 1000),
        confidence: Math.max(0, Math.min(1, Number(s.confidence) || 0.5)),
        status: "pending",
        assignee_user_id: cand.assignee_user_id,
      });
    }
  }

  if (inserted.length) {
    await sb.from("signal_agent_suggestions").insert(inserted);
  }
  return { candidates: candidates.length, suggestions: inserted.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
        .eq("feature_key", "signal_agent")
        .eq("enabled", true);
      orgIds = (data || []).map((r: any) => r.organization_id);
    }

    const results: any[] = [];
    for (const id of orgIds) {
      try {
        const r = await runForOrg(sb, id, apiKey);
        results.push({ organization_id: id, ...r });
      } catch (e) {
        results.push({ organization_id: id, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("signal-agent-run error", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

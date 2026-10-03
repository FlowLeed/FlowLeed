// FlowLeed Care Agent — Notice → Understand → Connect → Care → Continue.
// Principles: never guess who; never widen the care circle without pastor
// approval; AI prepares, pastors decide; care should feel personal.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { rejectUnlessCron } from "../_shared/cron-auth.ts";

const MAX_ORGS_PER_RUN = 10;
const MAX_PER_PERSON = 5;
const SENSITIVE = /(divorc|abuse|affair|suicid|self[- ]harm|arrest|legal|court|addict|overdose|miscarr|confidential|private|sexual|depress)/i;
const DAY = 86400000;

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Signal = { contact_id: string; kind: "life_moment" | "faith_moment" | "drift" | "follow_up"; key: string; fact: string; at: string; urgency: number; sensitive?: boolean; follow_up_of?: string; for_user?: string };

// verify_jwt is off (the daily cron call has no user), so check the leader's token with Auth
// instead of only decoding it.
async function userIdFromAuth(admin: SupabaseClient, h: string | null): Promise<string | null> {
  const token = h?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  try {
    // Manual run: one signed-in leader refreshes their own briefing.
    if (body.source !== "cron") {
      const userId = await userIdFromAuth(admin, req.headers.get("Authorization"));
      const orgId = typeof body.organizationId === "string" ? body.organizationId : null;
      if (!userId || !orgId) return json({ error: "Please sign in again." }, 401);
      const { data: mem } = await admin.from("organization_members").select("role").eq("organization_id", orgId).eq("user_id", userId).maybeSingle();
      if (!mem) return json({ error: "Forbidden" }, 403);
      const r = await runOrg(admin, orgId, userId);
      return json(r, r.error ? 503 : 200);
    }

    // Daily cron: bounded batch of churches not yet run today. Only the scheduler may start it.
    const unauthorized = rejectUnlessCron(req, corsHeaders);
    if (unauthorized) return unauthorized;
    const today = new Date().toISOString().slice(0, 10);
    const { data: orgs } = await admin.from("organizations").select("id").limit(500);
    const { data: states } = await admin.from("care_agent_state").select("*");
    const stateMap = new Map((states ?? []).map((s: any) => [s.organization_id, s]));
    const due = (orgs ?? []).filter((o: any) => {
      const s: any = stateMap.get(o.id);
      return !s || (s.last_run_date !== today && !s.paused_reason);
    }).slice(0, MAX_ORGS_PER_RUN);
    const results = [];
    for (const o of due) results.push({ org: o.id, ...(await runOrg(admin, o.id, null)) });
    return json({ ran: results.length, results });
  } catch (e) {
    console.error(e);
    return json({ error: "The care briefing could not run." }, 500);
  }
});

async function runOrg(admin: any, orgId: string, onlyUser: string | null): Promise<any> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  // Single-flight lease
  const { data: st } = await admin.from("care_agent_state").select("*").eq("organization_id", orgId).maybeSingle();
  if (st?.locked_until && new Date(st.locked_until) > now) return { skipped: "already running" };
  if (st?.paused_reason && !onlyUser) return { skipped: st.paused_reason };
  await admin.from("care_agent_state").upsert({ organization_id: orgId, locked_until: new Date(now.getTime() + 5 * 60000).toISOString(), updated_at: now.toISOString() });

  try {
    const signals = await notice(admin, orgId, now);
    const members = (await admin.from("organization_members").select("user_id, role").eq("organization_id", orgId)).data ?? [];
    const recipients = onlyUser ? members.filter((m: any) => m.user_id === onlyUser) : members;
    if (!signals.length || !recipients.length) { await finish(admin, orgId, today, null); return { created: 0 }; }

    const contactIds = [...new Set(signals.map((s) => s.contact_id))];
    const ctx = await understand(admin, orgId, contactIds, now);
    let created = 0;
    let pause: string | null = null;

    for (const r of recipients) {
      const scope = r.role === "owner" || r.role === "admin" ? null : ctx.scopeFor(r.user_id);
      const existing = (await admin.from("care_recommendations").select("contact_id, briefing_date, status, snoozed_until, follow_up_of")
        .eq("recipient_user_id", r.user_id).gte("created_at", new Date(now.getTime() - 7 * DAY).toISOString())).data ?? [];
      const snoozedOrRecent = new Set(existing.filter((e: any) => e.briefing_date !== today || e.status !== "pending" || (e.snoozed_until && new Date(e.snoozed_until) > now)).map((e: any) => e.contact_id));
      const already = new Set(existing.filter((e: any) => e.briefing_date === today).map((e: any) => e.contact_id));
      const usedFollowUps = new Set(existing.map((e: any) => e.follow_up_of).filter(Boolean));
      const handledBefore = new Set(existing.filter((e: any) => ["taking", "delegated", "handled"].includes(e.status)).map((e: any) => e.contact_id));

      const isPrayer = (s: any) => typeof s.key === "string" && s.key.startsWith("prayer:");
      const candidates = signals.filter((s) => {
        if (already.has(s.contact_id)) return false;
        const c = ctx.byId.get(s.contact_id);
        if (!c) return false;
        if (s.kind === "follow_up") return s.for_user === r.user_id && !usedFollowUps.has(s.follow_up_of);
        if (scope && !scope.has(s.contact_id)) return false;
        // A brand-new prayer request is a new need: don't hide it behind earlier care or open tasks.
        if (isPrayer(s)) return true;
        if (snoozedOrRecent.has(s.contact_id)) return false;
        if (c.recentCare || c.openTask) return false;           // already receiving care
        if (s.kind === "drift" && c.lifeSeason) return false;    // paused on purpose
        return true;
      }).map((s) => ({ ...s, tier: proximity(s, ctx.byId.get(s.contact_id), r.user_id, ctx, handledBefore) }));
      // Refreshes later in the day keep today's list calm: fill only the remaining slots,
      // but new prayer requests from the leader's circle always come through.
      const remaining = Math.max(0, MAX_PER_PERSON - already.size);
      const balanced = pickBalanced(candidates);
      const prayersInCircle = candidates.filter((s: any) => isPrayer(s) && s.tier <= 3).filter((s: any, i: number, a: any[]) => a.findIndex((x: any) => x.contact_id === s.contact_id) === i);
      const others = balanced.filter((s) => !prayersInCircle.some((p: any) => p.contact_id === s.contact_id));
      const picked = [...prayersInCircle, ...others].slice(0, Math.max(remaining, prayersInCircle.length));
      if (!picked.length) continue;

      const written = pause ? null : await writeCopy(picked.map((s) => ({ s, c: ctx.byId.get(s.contact_id) })));
      if (written && "pause" in written) pause = written.pause;
      const copy = written && "items" in written ? written.items : [];

      const rows = picked.map((s, i) => {
        const c = ctx.byId.get(s.contact_id);
        const sensitive = !!s.sensitive;
        const conn = sensitive ? null : connect(c, r.user_id, ctx);
        return {
          organization_id: orgId, recipient_user_id: r.user_id, contact_id: s.contact_id, briefing_date: today,
          kind: s.kind, signal_key: s.key, sensitive,
          headline: (copy[i]?.headline || defaultHeadline(s, c.name)).slice(0, 200),
          why: (copy[i]?.why || s.fact).slice(0, 600),
          known: c.known.slice(0, 6),
          best_connection: conn,
          follow_up_of: s.follow_up_of ?? null,
        };
      });
      const { error } = await admin.from("care_recommendations").upsert(rows, { onConflict: "recipient_user_id,contact_id,briefing_date", ignoreDuplicates: true });
      if (error) console.error("insert", error.message); else created += rows.length;
    }
    await finish(admin, orgId, today, pause);
    return { created, paused: pause };
  } catch (e) {
    await admin.from("care_agent_state").update({ locked_until: null }).eq("organization_id", orgId);
    throw e;
  }
}

async function finish(admin: any, orgId: string, today: string, pause: string | null) {
  await admin.from("care_agent_state").upsert({ organization_id: orgId, last_run_date: today, locked_until: null, paused_reason: pause, updated_at: new Date().toISOString() });
}

// ── NOTICE: observable facts only ─────────────────────────────────────────
async function notice(admin: any, orgId: string, now: Date): Promise<Signal[]> {
  const out: Signal[] = [];
  const since = (d: number) => new Date(now.getTime() - d * DAY).toISOString();

  const { data: prayers } = await admin.from("contact_prayer_requests").select("id, contact_id, description, title, created_at, kind, status")
    .eq("organization_id", orgId).not("contact_id", "is", null).gte("created_at", since(3)).limit(200);
  for (const p of prayers ?? []) {
    const text = `${p.title ?? ""} ${p.description ?? ""}`.trim();
    if (p.kind === "praise") out.push({ contact_id: p.contact_id, kind: "faith_moment", key: `praise:${p.id}`, fact: `Shared a praise report: "${text.slice(0, 160)}"`, at: p.created_at, urgency: 2 });
    else if (p.status !== "answered") out.push({ contact_id: p.contact_id, kind: "life_moment", key: `prayer:${p.id}`, fact: `Submitted a prayer request: "${text.slice(0, 160)}"`, at: p.created_at, urgency: 5, sensitive: SENSITIVE.test(text) });
  }

  const { data: types } = await admin.from("flow_moment_types").select("id, name, category").or(`organization_id.eq.${orgId},organization_id.is.null`);
  const typeMap = new Map((types ?? []).map((t: any) => [t.id, t]));
  if (typeMap.size) {
    const { data: moments } = await admin.from("flow_moments").select("id, contact_id, flow_moment_type_id, occurred_at, contacts!inner(organization_id)")
      .eq("contacts.organization_id", orgId).gte("occurred_at", since(7)).in("flow_moment_type_id", [...typeMap.keys()]).limit(200);
    for (const m of moments ?? []) {
      const t: any = typeMap.get(m.flow_moment_type_id);
      out.push({ contact_id: m.contact_id, kind: "faith_moment", key: `moment:${m.id}`, fact: `${t?.name ?? "A new milestone"} on ${String(m.occurred_at).slice(0, 10)}`, at: m.occurred_at, urgency: 3 });
    }
  }

  // Drift: regular group attender who has not been back for 4–10 weeks.
  const { data: drifters } = await admin.from("group_members").select("contact_id, last_attended_at, attendance_count, groups!inner(organization_id, name, status)")
    .eq("groups.organization_id", orgId).eq("status", "active").gte("attendance_count", 4)
    .lte("last_attended_at", since(28)).gte("last_attended_at", since(70)).limit(200);
  for (const d of drifters ?? []) {
    const weeks = Math.round((now.getTime() - new Date(d.last_attended_at).getTime()) / (7 * DAY));
    out.push({ contact_id: d.contact_id, kind: "drift", key: `drift:${d.contact_id}`, fact: `Attended ${(d as any).groups?.name ?? "their group"} ${d.attendance_count} times but has not been back in ${weeks} weeks`, at: d.last_attended_at, urgency: 3 });
  }

  // CONTINUE: follow-ups that came due.
  const { data: fups } = await admin.from("care_recommendations").select("id, contact_id, recipient_user_id, headline, acted_at, outcome")
    .eq("organization_id", orgId).in("status", ["taking", "delegated", "handled"]).lte("follow_up_at", now.toISOString()).gte("follow_up_at", since(14)).limit(200);
  for (const f of fups ?? []) {
    const days = f.acted_at ? Math.round((now.getTime() - new Date(f.acted_at).getTime()) / DAY) : 7;
    out.push({ contact_id: f.contact_id, kind: "follow_up", key: `follow:${f.id}`, fact: `${days} days ago: ${f.headline}. A short check-in could mean a lot.`, at: f.acted_at ?? now.toISOString(), urgency: 4, follow_up_of: f.id, for_user: f.recipient_user_id });
  }
  return out;
}

// ── UNDERSTAND: who is this person and are they already cared for? ─────────
async function understand(admin: any, orgId: string, ids: string[], now: Date) {
  const since = (d: number) => new Date(now.getTime() - d * DAY).toISOString();
  const [contacts, gm, pc, inter, tasks, seasons, eng, fam, profiles] = await Promise.all([
    admin.from("contacts").select("id, name, assigned_to_user_id").in("id", ids),
    admin.from("group_members").select("contact_id, joined_at, role, groups!inner(id, name, leader_user_id, co_leader_user_id, organization_id)").in("contact_id", ids).eq("status", "active"),
    admin.from("pipeline_contacts").select("contact_id, pipeline_id, assigned_to_user_id, completed_end_at, pipelines(name)").in("contact_id", ids),
    admin.from("contact_interactions").select("contact_id, created_by_user_id, created_at").in("contact_id", ids).gte("created_at", since(60)),
    admin.from("tasks").select("contact_id").in("contact_id", ids).is("completed_at", null),
    admin.from("contact_life_seasons").select("contact_id, reason").in("contact_id", ids).is("ended_on", null),
    admin.from("contact_engagement_scores").select("contact_id, signal, engagement_level").in("contact_id", ids),
    admin.from("contact_family_members").select("contact_id, relationship, is_child").in("contact_id", ids),
    admin.from("profiles").select("user_id, full_name"),
  ]);
  const names = new Map((profiles.data ?? []).map((p: any) => [p.user_id, p.full_name || "a teammate"]));
  const memberIds = new Set(((await admin.from("organization_members").select("user_id").eq("organization_id", orgId)).data ?? []).map((m: any) => m.user_id));
  const byId = new Map<string, any>();
  for (const c of contacts.data ?? []) byId.set(c.id, { ...c, known: [] as string[], groups: [], flowOwners: [], lastTouch: null as any });
  const scopes = new Map<string, Set<string>>();
  const addScope = (u: string | null, cid: string) => { if (!u) return; if (!scopes.has(u)) scopes.set(u, new Set()); scopes.get(u)!.add(cid); };

  for (const c of byId.values()) addScope(c.assigned_to_user_id, c.id);
  for (const g of gm.data ?? []) {
    const c = byId.get(g.contact_id); const grp: any = (g as any).groups; if (!c || grp.organization_id !== orgId) continue;
    c.groups.push({ name: grp.name, leader: grp.leader_user_id, joined: g.joined_at });
    c.known.push(`Member of ${grp.name}` + (grp.leader_user_id && names.get(grp.leader_user_id) ? ` — ${names.get(grp.leader_user_id)} is the leader` : ""));
    addScope(grp.leader_user_id, c.id); addScope(grp.co_leader_user_id, c.id);
  }
  for (const p of pc.data ?? []) {
    const c = byId.get(p.contact_id); if (!c) continue;
    if (!p.completed_end_at) { c.known.push(`In the ${(p as any).pipelines?.name ?? ""} Flow`.replace("the  Flow", "a Flow")); (c.pipelineIds ??= []).push(p.pipeline_id); }
    if (p.assigned_to_user_id) { c.flowOwners.push(p.assigned_to_user_id); addScope(p.assigned_to_user_id, c.id); }
  }
  const pipeIds = [...new Set((pc.data ?? []).map((p: any) => p.pipeline_id).filter(Boolean))];
  const teams = new Map<string, Set<string>>();
  if (pipeIds.length) {
    const { data: tm } = await admin.from("pipeline_team_members").select("pipeline_id, user_id").in("pipeline_id", pipeIds);
    for (const t of tm ?? []) { if (!teams.has(t.pipeline_id)) teams.set(t.pipeline_id, new Set()); teams.get(t.pipeline_id)!.add(t.user_id); }
  }
  for (const i of inter.data ?? []) {
    const c = byId.get(i.contact_id); if (!c) continue;
    if (i.created_by_user_id) (c.touchedBy ??= new Set<string>()).add(i.created_by_user_id);
    if (!c.lastTouch || i.created_at > c.lastTouch.at) c.lastTouch = { at: i.created_at, by: i.created_by_user_id };
  }
  for (const c of byId.values()) {
    const days = c.lastTouch ? Math.round((now.getTime() - new Date(c.lastTouch.at).getTime()) / DAY) : null;
    c.recentCare = days !== null && days <= 14;
    c.known.push(days === null ? "No care interaction recorded in the last 60 days" : `Last contact ${days} days ago${c.lastTouch.by && names.get(c.lastTouch.by) ? ` by ${names.get(c.lastTouch.by)}` : ""}`);
  }
  for (const t of tasks.data ?? []) { const c = byId.get(t.contact_id); if (c) c.openTask = true; }
  for (const s of seasons.data ?? []) { const c = byId.get(s.contact_id); if (c) c.lifeSeason = s.reason || true; }
  for (const e of eng.data ?? []) { const c = byId.get(e.contact_id); if (c && e.signal) c.known.push(`Engagement: ${e.signal}`); }
  const kids = new Map<string, number>();
  for (const f of fam.data ?? []) if (f.is_child) kids.set(f.contact_id, (kids.get(f.contact_id) ?? 0) + 1);
  for (const [cid, n] of kids) byId.get(cid)?.known.push(`Household with ${n} ${n === 1 ? "child" : "children"}`);

  return {
    byId, names, memberIds,
    scopeFor: (u: string) => scopes.get(u) ?? new Set<string>(),
    teamOf: (p: string) => teams.get(p) ?? new Set<string>(),
  } as any;
}

// ── CONNECT: best existing relationship, with evidence ──────────────────────
function connect(c: any, recipient: string, ctx: any) {
  const opts: any[] = [];
  for (const g of c.groups) if (g.leader && ctx.memberIds.has(g.leader)) {
    const months = g.joined ? Math.round((Date.now() - new Date(g.joined).getTime()) / (30 * DAY)) : null;
    opts.push({ user_id: g.leader, name: ctx.names.get(g.leader), role: `${g.name} leader`, why: months ? `In ${g.name} for ${months} months` : `Leads ${g.name}`, confidence: months && months >= 6 ? "High" : "Medium", score: 3 + (months ?? 0) / 12 });
  }
  if (c.lastTouch?.by && ctx.memberIds.has(c.lastTouch.by)) opts.push({ user_id: c.lastTouch.by, name: ctx.names.get(c.lastTouch.by), role: "Recently in touch", why: "Has the most recent recorded contact", confidence: "Medium", score: 2.5 });
  for (const u of c.flowOwners) if (ctx.memberIds.has(u)) opts.push({ user_id: u, name: ctx.names.get(u), role: "Assigned in a Flow", why: "Assigned to walk with them in a Flow", confidence: "Medium", score: 2 });
  if (c.assigned_to_user_id && ctx.memberIds.has(c.assigned_to_user_id)) opts.push({ user_id: c.assigned_to_user_id, name: ctx.names.get(c.assigned_to_user_id), role: "Assigned leader", why: "Listed as their assigned leader", confidence: "Medium", score: 1.5 });
  const best = opts.filter((o) => o.user_id !== recipient).sort((a, b) => b.score - a.score)[0];
  if (!best) return null;
  const { score: _s, ...rest } = best;
  return rest;
}

// Relational proximity to the recipient: 1 direct circle, 2 care history, 3 team Flow, 4 church-wide.
function proximity(s: Signal, c: any, userId: string, ctx: any, handledBefore: Set<string>): number {
  if (s.kind === "follow_up") return 1;
  if (ctx.scopeFor(userId).has(c.id)) return 1;
  if (c.touchedBy?.has(userId) || handledBefore.has(c.id)) return 2;
  if ((c.pipelineIds ?? []).some((p: string) => ctx.teamOf(p).has(userId))) return 3;
  return 4;
}

const CHURCH_WIDE_BACKFILL = 2;

function pickBalanced(cands: (Signal & { tier: number })[]): Signal[] {
  const byContact = new Map<string, Signal & { tier: number }>();
  for (const s of [...cands].sort((a, b) => a.tier - b.tier || b.urgency - a.urgency || b.at.localeCompare(a.at))) if (!byContact.has(s.contact_id)) byContact.set(s.contact_id, s);
  const all = [...byContact.values()];
  const circle = all.filter((s) => s.tier <= 3);
  const picked: Signal[] = [];
  // Your circles first: balance kinds within tiers 1–3, closest people first.
  for (const k of ["life_moment", "drift", "faith_moment", "follow_up"] as const) { const s = circle.find((x) => x.kind === k); if (s) picked.push(s); }
  for (const s of circle) { if (picked.length >= MAX_PER_PERSON) break; if (!picked.includes(s)) picked.push(s); }
  // Backfill only when needed, with urgent church-wide needs.
  const wide = all.filter((s) => s.tier === 4 && s.urgency >= 4);
  for (const s of wide.slice(0, CHURCH_WIDE_BACKFILL)) { if (picked.length >= Math.min(3, MAX_PER_PERSON)) break; picked.push(s); }
  return picked.slice(0, MAX_PER_PERSON).sort((a: any, b: any) => a.tier - b.tier);
}

function defaultHeadline(s: Signal, name: string) {
  return { life_moment: `${name} shared something on their heart`, faith_moment: `${name} reached a new step`, drift: `${name} hasn't been around lately`, follow_up: `Check back in with ${name}` }[s.kind];
}

// AI writes warm, factual copy. Facts only — never diagnose.
async function writeCopy(items: { s: Signal; c: any }[]): Promise<{ items: { headline: string; why: string }[] } | { pause: string } | null> {
  const key = Deno.env.get("LOVABLE_API_KEY"); if (!key) return null;
  const facts = items.map((x, i) => ({ i, name: x.c.name, type: x.s.kind, fact: x.s.sensitive ? "Submitted a private prayer request (details withheld)" : x.s.fact, known: x.c.known }));
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra", reasoning_effort: "low", stream: true, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You help a pastor notice people who may need care. For each item write a short headline (under 12 words, use the person's first name) and a 1–2 sentence 'why' stating only observable facts. Never diagnose, guess motives, or say things like 'falling away'. Warm, plain, personal. Return JSON {\"items\":[{\"i\":0,\"headline\":\"\",\"why\":\"\"}]}." },
        { role: "user", content: JSON.stringify(facts) },
      ],
    }),
  });
  if (r.status === 402 || r.status === 403) return { pause: r.status === 402 ? "AI credits are used up" : "AI access is blocked for this workspace" };
  if (!r.ok || !r.body) { console.error("gateway", r.status, await r.text()); return null; }
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "", out = "";
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop() ?? "";
    for (const l of lines) { const t = l.trim(); if (!t.startsWith("data:")) continue; const d = t.slice(5).trim(); if (d === "[DONE]") continue; try { out += JSON.parse(d).choices?.[0]?.delta?.content ?? ""; } catch { /* partial */ } }
  }
  try {
    const p = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
    const res: { headline: string; why: string }[] = [];
    for (const it of p.items ?? []) if (typeof it.i === "number") res[it.i] = { headline: String(it.headline ?? ""), why: String(it.why ?? "") };
    return { items: res };
  } catch { return null; }
}

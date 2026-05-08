import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Level = "highly_engaged" | "active" | "at_risk" | "inactive" | "new";

const LEVELS: { key: Level; label: string; color: string; goodDir: "up" | "down" }[] = [
  { key: "highly_engaged", label: "Highly Engaged", color: "#10b981", goodDir: "up" },
  { key: "active", label: "Active", color: "#3b82f6", goodDir: "up" },
  { key: "at_risk", label: "At Risk", color: "#f59e0b", goodDir: "down" },
  { key: "inactive", label: "Inactive", color: "#ef4444", goodDir: "down" },
  { key: "new", label: "New", color: "#8b5cf6", goodDir: "up" },
];

const APP_URL = "https://app.flowleed.com";

interface Snapshot {
  organization_id: string;
  level: Level;
  count: number;
  taken_at: string;
}

function deltaBadge(delta: number, goodDir: "up" | "down"): string {
  if (delta === 0) return `<span style="color:#94a3b8;font-size:12px;">±0</span>`;
  const isGood = (delta > 0 && goodDir === "up") || (delta < 0 && goodDir === "down");
  const color = isGood ? "#059669" : "#dc2626";
  const sign = delta > 0 ? "+" : "";
  return `<span style="color:${color};font-size:12px;font-weight:600;">${sign}${delta}</span>`;
}

function buildHTML(
  orgName: string,
  userName: string,
  current: Record<Level, number>,
  baseline7: Record<Level, number> | null,
  baseline30: Record<Level, number> | null
): string {
  const total = LEVELS.reduce((s, l) => s + (current[l.key] || 0), 0);
  const max = Math.max(1, ...LEVELS.map((l) => current[l.key] || 0));

  const rows = LEVELS.map((l) => {
    const count = current[l.key] || 0;
    const pct = Math.round((count / max) * 100);
    const d7 = baseline7 ? count - (baseline7[l.key] || 0) : 0;
    const d30 = baseline30 ? count - (baseline30[l.key] || 0) : 0;
    return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div>
              <span style="font-weight:600;color:#0f172a;font-size:15px;">${l.label}</span>
              <span style="color:#64748b;font-size:13px;margin-left:8px;">${count}</span>
            </div>
            <div style="font-size:12px;">
              <span style="color:#64748b;margin-right:10px;">7d ${deltaBadge(d7, l.goodDir)}</span>
              <span style="color:#64748b;">30d ${deltaBadge(d30, l.goodDir)}</span>
            </div>
          </div>
          <div style="background:#f1f5f9;border-radius:9999px;height:8px;overflow:hidden;">
            <div style="background:${l.color};height:8px;width:${pct}%;border-radius:9999px;"></div>
          </div>
        </td>
      </tr>`;
  }).join("");

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Weekly Heartbeat</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px;">
        <tr><td>
          <p style="margin:0 0 8px;color:#64748b;font-size:13px;">${orgName}</p>
          <h1 style="margin:0 0 6px;color:#0f172a;font-size:22px;">Weekly Church Heartbeat</h1>
          <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Hi ${userName || "there"}, here's your church's engagement snapshot — ${total} scored ${total === 1 ? "person" : "people"}.</p>
          <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
          <div style="margin-top:28px;text-align:center;">
            <a href="${APP_URL}/analytics" style="display:inline-block;background:#0f172a;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open Heartbeat</a>
          </div>
          <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;text-align:center;">Deltas compare today's snapshot to 7 and 30 days ago.</p>
        </td></tr>
      </table>
      <p style="color:#94a3b8;font-size:11px;margin-top:16px;">You can disable this weekly digest in your profile notification settings.</p>
    </td></tr>
  </table>
</body></html>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendKey);
    const now = new Date();

    // 1. Snapshot current engagement counts per org
    const { data: scores, error: scoresErr } = await supabase
      .from("contact_engagement_scores")
      .select("organization_id, engagement_level");
    if (scoresErr) throw scoresErr;

    const currentByOrg = new Map<string, Record<Level, number>>();
    for (const r of scores || []) {
      const orgId = (r as any).organization_id as string;
      const lvl = (r as any).engagement_level as Level;
      if (!orgId || !lvl) continue;
      if (!currentByOrg.has(orgId)) {
        currentByOrg.set(orgId, { highly_engaged: 0, active: 0, at_risk: 0, inactive: 0, new: 0 });
      }
      const m = currentByOrg.get(orgId)!;
      if (lvl in m) m[lvl] = (m[lvl] || 0) + 1;
    }

    // Persist today's snapshot rows
    const snapshotRows: Snapshot[] = [];
    for (const [orgId, counts] of currentByOrg.entries()) {
      for (const l of LEVELS) {
        snapshotRows.push({
          organization_id: orgId,
          level: l.key,
          count: counts[l.key] || 0,
          taken_at: now.toISOString(),
        });
      }
    }
    if (snapshotRows.length > 0) {
      const { error: insErr } = await supabase.from("heartbeat_snapshots").insert(snapshotRows);
      if (insErr) console.error("snapshot insert error", insErr);
    }

    // 2. Get baselines (7d and 30d ago, nearest snapshot within ±2 days)
    async function loadBaseline(daysAgo: number): Promise<Map<string, Record<Level, number>>> {
      const target = new Date(now.getTime() - daysAgo * 86400000);
      const start = new Date(target.getTime() - 2 * 86400000).toISOString();
      const end = new Date(target.getTime() + 2 * 86400000).toISOString();
      const { data } = await supabase
        .from("heartbeat_snapshots")
        .select("organization_id, level, count, taken_at")
        .gte("taken_at", start)
        .lte("taken_at", end)
        .order("taken_at", { ascending: false });
      const map = new Map<string, Record<Level, number>>();
      const seen = new Set<string>();
      for (const r of data || []) {
        const key = `${(r as any).organization_id}|${(r as any).level}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const orgId = (r as any).organization_id as string;
        if (!map.has(orgId)) map.set(orgId, { highly_engaged: 0, active: 0, at_risk: 0, inactive: 0, new: 0 });
        map.get(orgId)![(r as any).level as Level] = (r as any).count as number;
      }
      return map;
    }
    const baseline7 = await loadBaseline(7);
    const baseline30 = await loadBaseline(30);

    // 3. For each org, send to leaders (owner/admin) opted in
    let emailsSent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [orgId, current] of currentByOrg.entries()) {
      const total = LEVELS.reduce((s, l) => s + current[l.key], 0);
      if (total === 0) { skipped++; continue; }

      const { data: org } = await supabase
        .from("organizations").select("name").eq("id", orgId).maybeSingle();
      const orgName = (org as any)?.name || "Your church";

      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId)
        .in("role", ["owner", "admin"]);

      const userIds = (members || []).map((m: any) => m.user_id);
      if (userIds.length === 0) { skipped++; continue; }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, notification_preferences")
        .in("user_id", userIds);

      for (const p of profiles || []) {
        const prefs = (p as any).notification_preferences || {};
        if (prefs.weekly_heartbeat_enabled === false) { skipped++; continue; }
        const email = (p as any).email;
        if (!email) { skipped++; continue; }

        try {
          const html = buildHTML(
            orgName,
            (p as any).full_name || "",
            current,
            baseline7.get(orgId) || null,
            baseline30.get(orgId) || null
          );
          await resend.emails.send({
            from: "Flowleed <noreply@flowleed.com>",
            to: [email],
            subject: `Weekly Heartbeat: ${orgName}`,
            html,
          });
          emailsSent++;
        } catch (e) {
          errors.push(`${email}: ${String(e)}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent, skipped, errors: errors.length, errorDetails: errors.slice(0, 10) }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("send-heartbeat-digest error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

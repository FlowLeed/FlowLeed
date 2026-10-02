import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { rejectUnlessCron } from "../_shared/cron-auth.ts";
import { sendWebPush } from "../_shared/web-push.ts";

interface Payload {
  user_id?: string;
  user_ids?: string[];
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Only internal callers: the notify_push_on_notification() trigger and send-test-push. Without
  // this check, anyone holding the public anon key could push to any user.
  const unauthorized = rejectUnlessCron(req, corsHeaders);
  if (unauthorized) return unauthorized;

  const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@flowleed.com";
  // redeploy marker: pickup VAPID secrets
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const payload = (await req.json()) as Payload;
    const userIds = payload.user_ids ?? (payload.user_id ? [payload.user_id] : []);
    if (!userIds.length || !payload.title) {
      return new Response(JSON.stringify({ error: "user_id(s) and title required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", userIds);
    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_subscriptions" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const notif = {
      title: payload.title,
      body: payload.body ?? "",
      url: payload.url ?? "/",
      tag: payload.tag,
      icon: payload.icon ?? "/icons/icon-192.png",
      badge: payload.badge ?? "/icons/icon-192.png",
      data: payload.data ?? {},
    };

    const staleIds: string[] = [];
    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        const res = await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, notif, {
          vapidPublicKey: VAPID_PUBLIC, vapidPrivateKey: VAPID_PRIVATE, subject: VAPID_SUBJECT,
        });
        if (res.status === 404 || res.status === 410) {
          staleIds.push(s.id);
        } else if (res.status >= 200 && res.status < 300) {
          sent++;
        } else {
          console.warn("[send-push] non-2xx", res.status, await res.text());
        }
      } catch (e) {
        console.error("[send-push] failed", e);
      }
    }));

    if (staleIds.length) {
      await admin.from("push_subscriptions").delete().in("id", staleIds);
    }

    return new Response(JSON.stringify({ ok: true, sent, removed_stale: staleIds.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[send-push] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// Content module: periodically retry failed video ingests.
// Finds recently-failed videos (retry_count < MAX_RETRIES) that haven't been
// retried in the last cooldown window, and re-invokes content-ingest for each.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_RETRIES = 3;
const COOLDOWN_MINUTES = 5;
const MAX_AGE_DAYS = 30;
const BATCH_SIZE = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const cooldown = new Date(Date.now() - COOLDOWN_MINUTES * 60_000).toISOString();
    const maxAge = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60_000).toISOString();

    const { data: candidates, error } = await admin
      .from("content_videos")
      .select("id, youtube_id, organization_id, retry_count, last_retry_at, created_at")
      .eq("ingest_status", "failed")
      .lt("retry_count", MAX_RETRIES)
      .gte("created_at", maxAge)
      .or(`last_retry_at.is.null,last_retry_at.lt.${cooldown}`)
      .order("last_retry_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);

    if (error) throw error;

    const results: Array<{ videoId: string; ok: boolean; error?: string }> = [];

    for (const v of candidates ?? []) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/content-ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({
            internal: true,
            action: "retry",
            videoId: v.id,
          }),
        });
        results.push({ videoId: v.id as string, ok: r.ok, error: r.ok ? undefined : await r.text() });
      } catch (e: any) {
        results.push({ videoId: v.id as string, ok: false, error: String(e?.message ?? e) });
      }
    }

    console.log(`[content-retry-failed] processed ${results.length} videos`, results);

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[content-retry-failed] error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

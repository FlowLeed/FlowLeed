// Content module: analyze a video using its transcript chunks.
// Writes a content_analyses row and sets the video to ready.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const MODEL = "google/gemini-3-flash-preview";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM = `You analyze transcripts of videos (often sermons, talks, or stories) and extract narrative structure.
Always respond as JSON matching this shape:
{
  "summary": string (2-4 sentences),
  "themes": string[] (3-7 short tags),
  "story_patterns": [{"name": string, "description": string}],
  "key_quotes": [{"text": string, "start_seconds": number, "impact_score": number 1-10}],
  "impact_score": number 1-10
}
story_patterns examples: hero's journey, transformation, testimony, conflict-to-resolution, prophetic warning, exhortation.
Use exact start_seconds values from the transcript chunks. Pick 4-8 of the most powerful quotes.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const videoId: string = body.videoId;
    const organizationId: string | undefined = body.organizationId;
    const internal: boolean = !!body.internal;

    if (!videoId) {
      return new Response(JSON.stringify({ error: "videoId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Auth: if not internal service call, verify user is org member
    if (!internal) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claims } = await userClient.auth.getClaims(token);
      if (!claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: video } = await admin.from("content_videos")
        .select("organization_id").eq("id", videoId).maybeSingle();
      if (!video) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: mem } = await admin.from("organization_members")
        .select("role").eq("organization_id", video.organization_id)
        .eq("user_id", claims.claims.sub).maybeSingle();
      if (!mem) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: video } = await admin
      .from("content_videos")
      .select("id, organization_id, title")
      .eq("id", videoId).maybeSingle();
    if (!video) throw new Error("video not found");

    const { data: chunks } = await admin
      .from("content_transcript_chunks")
      .select("text, start_seconds")
      .eq("video_id", videoId)
      .order("chunk_index", { ascending: true });
    if (!chunks || chunks.length === 0) throw new Error("No transcript chunks to analyze");

    const transcript = chunks
      .map((c) => `[${c.start_seconds}s] ${c.text}`)
      .join("\n");
    const truncated = transcript.length > 60000 ? transcript.slice(0, 60000) + "\n…[truncated]" : transcript;

    const r = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Title: ${video.title ?? "(untitled)"}\n\nTranscript:\n${truncated}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`AI gateway ${r.status}: ${text}`);
    }
    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    await admin.from("content_analyses").insert({
      video_id: videoId,
      organization_id: video.organization_id,
      summary: parsed.summary ?? null,
      themes: Array.isArray(parsed.themes) ? parsed.themes : [],
      story_patterns: Array.isArray(parsed.story_patterns) ? parsed.story_patterns : [],
      key_quotes: Array.isArray(parsed.key_quotes) ? parsed.key_quotes : [],
      impact_score: typeof parsed.impact_score === "number" ? Math.round(parsed.impact_score) : null,
      model: MODEL,
    });

    await admin.from("content_videos").update({
      ingest_status: "ready",
      error_message: null,
    }).eq("id", videoId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[content-analyze] error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

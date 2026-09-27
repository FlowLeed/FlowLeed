// Drafts a readable story (title, summary, blocks) from a video's transcript.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `You turn a video transcript of a personal church testimony into a short, warm, readable written story.
Write in the third person for narrative text, past tense, simple human language. Use the person's own words ONLY inside quote blocks, copied faithfully from the transcript (light cleanup of filler words allowed). Never invent facts.
Respond as JSON only:
{"title": string (short, emotional), "person_name": string (first name or family, "" if unknown), "summary": string (1-2 sentences),
 "blocks": [{"type":"heading"|"paragraph"|"quote","text":string,"attribution"?:string}]}
Structure: 2-3 chapters (e.g. "Before", "What changed", "Today"), each a heading followed by 1-2 short paragraphs (2-4 sentences each). Include 2-3 quote blocks placed where they fit. Keep total under ~500 words.`;

function getUserIdFromJwt(authHeader: string): string | null {
  try {
    const payload = authHeader.replace("Bearer ", "").split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
    const claims = JSON.parse(atob(padded));
    return typeof claims?.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const videoId = body?.videoId;
    if (typeof videoId !== "string" || !/^[0-9a-f-]{36}$/i.test(videoId)) return json({ error: "videoId required" }, 400);
    const guidance = typeof body?.guidance === "string" ? body.guidance.trim().slice(0, 1000) : "";
    const knownName = typeof body?.personName === "string" ? body.personName.trim().slice(0, 120) : "";
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    // Verify through RLS rather than Auth session lookup: valid app tokens can fail
    // getClaims/getUser with "Session not found" after token rotation.
    const userId = getUserIdFromJwt(auth);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { data: video } = await admin.from("content_videos").select("organization_id, title").eq("id", videoId).maybeSingle();
    if (!video) return json({ error: "Not found" }, 404);
    const { data: mem, error: memErr } = await userClient.from("organization_members").select("user_id, role")
      .eq("organization_id", video.organization_id).eq("user_id", userId).maybeSingle();
    if (memErr || !mem?.user_id) {
      console.error("membership check failed", memErr?.message);
      return json({ error: "Forbidden" }, 403);
    }


    const { data: chunks } = await admin.from("content_transcript_chunks").select("text")
      .eq("video_id", videoId).order("chunk_index", { ascending: true });
    if (!chunks?.length) return json({ error: "This video has no transcript yet." }, 400);
    const transcript = chunks.map((c) => c.text).join("\n").slice(0, 60000);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        stream: true,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Video title: ${video.title ?? ""}${knownName ? `\nPerson/family name (use exactly): ${knownName}` : ""}${guidance ? `\n\nEditor guidance (high priority — follow it, e.g. pronouns, focus, tone; still never invent facts):\n${guidance}` : ""}\n\nTranscript:\n${transcript}` },
        ],
      }),
    });
    if (!r.ok || !r.body) {
      const t = await r.text();
      console.error("gateway", r.status, t);
      const msg = r.status === 429 ? "Too many requests — try again in a minute."
        : r.status === 402 ? "AI credits are used up. Add credits in Settings → Plans & credits."
        : "Couldn't draft the story right now.";
      return json({ error: msg }, r.status === 429 || r.status === 402 ? r.status : 502);
    }
    // Accumulate SSE stream
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "", out = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith("data:")) continue;
        const d = l.slice(5).trim();
        if (d === "[DONE]") continue;
        try { out += JSON.parse(d).choices?.[0]?.delta?.content ?? ""; } catch { /* partial */ }
      }
    }
    let parsed: any = {};
    try { parsed = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)); } catch { /* ignore */ }
    const blocks = (Array.isArray(parsed.blocks) ? parsed.blocks : [])
      .filter((b: any) => ["heading", "paragraph", "quote"].includes(b?.type) && typeof b.text === "string" && b.text.trim())
      .slice(0, 20)
      .map((b: any) => ({ type: b.type, text: String(b.text).trim().slice(0, 3000), attribution: typeof b.attribution === "string" ? b.attribution.slice(0, 120) : undefined }));
    if (!blocks.length) return json({ error: "The AI couldn't build a story from this transcript." }, 502);
    return json({
      title: typeof parsed.title === "string" ? parsed.title.slice(0, 200) : "",
      person_name: typeof parsed.person_name === "string" ? parsed.person_name.slice(0, 120) : "",
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 600) : "",
      blocks,
    });
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong drafting the story." }, 500);
  }
});

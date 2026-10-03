// Content module: RAG chat. Streams a response with citations.
// Embeds the query, fetches top-k matching chunks via match_content_chunks,
// then streams a model response prefixed by a JSON header of citations.
import { createClient } from "@supabase/supabase-js";
import { glooChatStream, glooEmbed } from "../_shared/gloo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;


async function embed(text: string): Promise<number[]> {
  const [vector] = await glooEmbed([text]);
  return vector;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
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
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const message: string = body.message;
    const organizationId: string = body.organizationId;
    const videoId: string | undefined = body.videoId;
    const sessionId: string | undefined = body.sessionId;
    if (!message || !organizationId) {
      return new Response(JSON.stringify({ error: "message and organizationId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: mem } = await admin.from("organization_members")
      .select("role").eq("organization_id", organizationId)
      .eq("user_id", userId).maybeSingle();
    if (!mem) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure / create session
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const ins = await admin.from("content_chat_sessions").insert({
        user_id: userId,
        organization_id: organizationId,
        video_id: videoId ?? null,
        title: message.slice(0, 80),
      }).select("id").single();
      if (ins.error) throw ins.error;
      activeSessionId = ins.data.id;
    }

    // Save user message
    await admin.from("content_chat_messages").insert({
      session_id: activeSessionId,
      role: "user",
      content: message,
    });

    // Retrieve
    const qvec = await embed(message);
    const { data: matches, error: matchError } = await admin.rpc("match_content_chunks", {
      query_embedding: qvec as unknown as string,
      p_org_id: organizationId,
      p_video_id: videoId ?? null,
      match_threshold: 0.25,
      match_count: 8,
    });
    if (matchError) console.warn("match error", matchError);

    const matchList = (matches ?? []) as Array<{
      chunk_id: string; video_id: string; chunk_index: number;
      text: string; start_seconds: number; end_seconds: number; similarity: number;
    }>;

    // Fetch video metadata for citations
    const videoIds = Array.from(new Set(matchList.map((m) => m.video_id)));
    const { data: videos } = videoIds.length
      ? await admin.from("content_videos")
          .select("id, title, thumbnail_url, channel_name")
          .in("id", videoIds)
      : { data: [] as any[] };
    const videoMap = new Map((videos ?? []).map((v: any) => [v.id, v]));

    const citations = matchList.map((m, i) => {
      const v = videoMap.get(m.video_id) ?? {};
      return {
        id: i + 1,
        chunk_id: m.chunk_id,
        video_id: m.video_id,
        title: v.title ?? "Untitled",
        thumbnail_url: v.thumbnail_url ?? null,
        channel_name: v.channel_name ?? null,
        start_seconds: m.start_seconds,
        snippet: m.text.slice(0, 240),
      };
    });

    const context = matchList.length === 0
      ? "(no matching transcript chunks)"
      : matchList.map((m, i) => `[${i + 1}] (${m.start_seconds}s) ${m.text}`).join("\n\n");

    const systemPrompt = `You are a research assistant for a library of video transcripts.
Answer concisely using ONLY the provided excerpts. When you cite, use bracket numbers like [1], [2].
If the excerpts do not answer the question, say so.`;
    const userPrompt = `Question: ${message}\n\nExcerpts:\n${context}`;

    // Stream
    const upstream = await glooChatStream({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    // Prepend a JSON header line with session + citations, then forward SSE
    const encoder = new TextEncoder();
    const headerLine = `event: meta\ndata: ${JSON.stringify({ sessionId: activeSessionId, citations })}\n\n`;

    let assistantBuf = "";
    const decoder = new TextDecoder();
    const transformed = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(headerLine));
        const reader = upstream.getReader();
        let leftover = "";
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            leftover += chunk;
            const lines = leftover.split("\n");
            leftover = lines.pop() ?? "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const payload = line.slice(6).trim();
                if (payload === "[DONE]") continue;
                try {
                  const j = JSON.parse(payload);
                  const delta = j.choices?.[0]?.delta?.content;
                  if (delta) assistantBuf += delta;
                } catch { /* ignore parse errors */ }
              }
              controller.enqueue(encoder.encode(line + "\n"));
            }
          }
        } finally {
          // Save assistant message
          try {
            await admin.from("content_chat_messages").insert({
              session_id: activeSessionId,
              role: "assistant",
              content: assistantBuf,
              citations,
            });
            await admin.from("content_chat_sessions")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", activeSessionId);
          } catch (e) { console.warn("[content-chat] save error", e); }
          controller.close();
        }
      },
    });

    return new Response(transformed, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e: any) {
    console.error("[content-chat] error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

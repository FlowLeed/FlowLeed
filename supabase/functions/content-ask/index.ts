// Content module: AI-grounded answer over transcript chunks.
// Returns a short narrative answer with quoted snippets and a list of source
// videos with timestamps, similar to a RAG-style answer card.
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

async function embed(text: string): Promise<number[]> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-embedding-001",
      input: text,
      dimensions: 384,
    }),
  });
  if (!r.ok) throw new Error(`embed ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.data[0].embedding;
}

interface Source {
  index: number;
  video_id: string;
  chunk_id: string;
  title: string | null;
  thumbnail_url: string | null;
  channel_name: string | null;
  snippet: string;
  start_seconds: number;
  similarity: number;
}

function formatTime(s: number): string {
  const sec = Math.max(0, Math.floor(s));
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

async function synthesize(query: string, sources: Source[]): Promise<string> {
  const context = sources
    .map(
      (s) =>
        `[#${s.index}] "${(s.title ?? "Untitled").trim()}" @ ${formatTime(s.start_seconds)}\n${s.snippet.trim()}`,
    )
    .join("\n\n---\n\n");

  const system = `You are a thoughtful research assistant helping a pastoral team explore their video library.

You will be given a question and a set of transcript excerpts from videos. Write a short, warm, conversational answer that directly responds to the question, grounded ONLY in the excerpts.

Rules:
- Write 2-5 short paragraphs in plain markdown. No headings.
- Weave in 1-3 brief direct quotes from the excerpts. Each quote MUST be cited inline with its source marker like [#1] or [#3] immediately after the quote.
- Reference at least 2 sources when available. Do not invent quotes or facts.
- Use natural pastoral language ("stories", "moments", "voices"), not academic tone.
- If the excerpts don't actually answer the question, say so gently in one sentence and suggest what the library does cover.
- Never list "Sources" at the end — the UI shows those separately.`;

  const user = `Question: ${query}\n\nExcerpts:\n\n${context}`;

  const r = await fetch("https://platform.ai.gloo.com/ai/v2/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gloo-google-gemini-3-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`llm ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const query: string = body.query;
    const organizationId: string | undefined = body.organizationId;
    const orgSlug: string | undefined = body.orgSlug;
    const isPublic = !!body.public;

    if (!query || (!isPublic && !organizationId) || (isPublic && !orgSlug)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (!isPublic) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claims } = await userClient.auth.getClaims(token);
      if (!claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: mem } = await admin
        .from("organization_members")
        .select("role")
        .eq("organization_id", organizationId!)
        .eq("user_id", claims.claims.sub)
        .maybeSingle();
      if (!mem) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const qvec = await embed(query);
    const rpc = isPublic
      ? await admin.rpc("match_content_chunks_public", {
          query_embedding: qvec as unknown as string,
          p_org_slug: orgSlug,
          match_threshold: 0.2,
          match_count: 12,
        })
      : await admin.rpc("match_content_chunks", {
          query_embedding: qvec as unknown as string,
          p_org_id: organizationId,
          p_video_id: null,
          match_threshold: 0.2,
          match_count: 12,
        });
    if (rpc.error) throw rpc.error;

    const matches = (rpc.data ?? []) as Array<{
      chunk_id: string;
      video_id: string;
      chunk_index: number;
      text: string;
      start_seconds: number;
      end_seconds: number;
      similarity: number;
    }>;

    if (!matches.length) {
      return new Response(
        JSON.stringify({
          answer:
            "I couldn't find anything in the library that speaks to that yet. Try rephrasing, or explore the categories below.",
          sources: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const videoIds = Array.from(new Set(matches.map((m) => m.video_id)));
    const { data: videos } = await admin
      .from("content_videos")
      .select("id, title, thumbnail_url, channel_name")
      .in("id", videoIds);
    const vmap = new Map((videos ?? []).map((v: any) => [v.id, v]));

    // Limit to top sources fed to the LLM (keep prompts tight).
    const top = matches.slice(0, 6);
    const sources: Source[] = top.map((m, i) => {
      const v = vmap.get(m.video_id) ?? {};
      return {
        index: i + 1,
        video_id: m.video_id,
        chunk_id: m.chunk_id,
        title: v.title ?? null,
        thumbnail_url: v.thumbnail_url ?? null,
        channel_name: v.channel_name ?? null,
        snippet: m.text,
        start_seconds: m.start_seconds,
        similarity: m.similarity,
      };
    });

    const answer = await synthesize(query, sources);

    return new Response(JSON.stringify({ answer, sources }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[content-ask] error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

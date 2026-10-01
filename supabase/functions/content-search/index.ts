// Content module: semantic search over transcript chunks.
import { createClient } from "@supabase/supabase-js";

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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (!isPublic) {
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
      const { data: mem } = await admin.from("organization_members")
        .select("role").eq("organization_id", organizationId!)
        .eq("user_id", claims.claims.sub).maybeSingle();
      if (!mem) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const qvec = await embed(query);
    const rpc = isPublic
      ? await admin.rpc("match_content_chunks_public", {
          query_embedding: qvec as unknown as string,
          p_org_slug: orgSlug,
          match_threshold: 0.2,
          match_count: 20,
        })
      : await admin.rpc("match_content_chunks", {
          query_embedding: qvec as unknown as string,
          p_org_id: organizationId,
          p_video_id: null,
          match_threshold: 0.2,
          match_count: 20,
        });
    if (rpc.error) throw rpc.error;

    const matches = (rpc.data ?? []) as Array<{
      chunk_id: string; video_id: string; chunk_index: number;
      text: string; start_seconds: number; end_seconds: number; similarity: number;
    }>;

    const videoIds = Array.from(new Set(matches.map((m) => m.video_id)));
    const { data: videos } = videoIds.length
      ? await admin.from("content_videos")
          .select("id, title, thumbnail_url, channel_name, published_at, consent_level")
          .in("id", videoIds)
      : { data: [] as any[] };
    const vmap = new Map((videos ?? []).map((v: any) => [v.id, v]));

    const results = matches.map((m) => {
      const v = vmap.get(m.video_id) ?? {};
      return {
        video_id: m.video_id,
        chunk_id: m.chunk_id,
        title: v.title,
        thumbnail_url: v.thumbnail_url,
        channel_name: v.channel_name,
        snippet: m.text,
        start_seconds: m.start_seconds,
        similarity: m.similarity,
      };
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[content-search] error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

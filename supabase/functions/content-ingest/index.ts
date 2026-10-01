// Content module: ingest a YouTube URL.
// Creates the content_videos row, fetches metadata + transcript,
// chunks, embeds, then analyzes. Runs sequentially inline.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPADATA_API_KEY = Deno.env.get("SUPADATA_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1";

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      // /shorts/<id> or /embed/<id>
      const m = u.pathname.match(/\/(shorts|embed|v)\/([A-Za-z0-9_-]{6,})/);
      if (m) return m[2];
    }
  } catch (_) { /* ignore */ }
  // raw id
  if (/^[A-Za-z0-9_-]{6,}$/.test(url)) return url;
  return null;
}

async function fetchYouTubeOEmbed(youtubeId: string) {
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`,
    );
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

interface TranscriptSegment {
  text: string;
  offset_ms: number; // start time in milliseconds
  duration_ms?: number;
}

async function fetchTranscriptViaSupadata(youtubeId: string): Promise<TranscriptSegment[] | null> {
  if (!SUPADATA_API_KEY) return null;
  try {
    const r = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${youtubeId}&text=false`,
      { headers: { "x-api-key": SUPADATA_API_KEY } },
    );
    if (!r.ok) {
      console.warn("[supadata] non-ok", r.status, await r.text());
      return null;
    }
    const data = await r.json();
    const content = data.content || data.transcript || [];
    if (!Array.isArray(content) || content.length === 0) return null;
    return content.map((c: any) => ({
      text: c.text ?? "",
      offset_ms: Number(c.offset ?? c.start ?? 0),
      duration_ms: Number(c.duration ?? 0),
    })).filter((s) => s.text.trim().length > 0);
  } catch (e) {
    console.warn("[supadata] error", e);
    return null;
  }
}

// TODO: reconsider the decision to  a fallback to innertube,
// Conside moving key to env
async function fetchTranscriptViaInnertube(youtubeId: string): Promise<TranscriptSegment[] | null> {
  // Lightweight Innertube fallback: rotate through web client and parse caption tracks
  // We attempt the youtubei/v1/player endpoint and read captionTracks baseUrl.
  const clients = [
    { clientName: "WEB", clientVersion: "2.20240101.00.00" },
    { clientName: "ANDROID", clientVersion: "19.09.37" },
    { clientName: "IOS", clientVersion: "19.09.3" },
  ];
  for (const client of clients) {
    try {
      const r = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId: youtubeId,
            context: { client: { ...client, hl: "en", gl: "US" } },
          }),
        },
      );
      if (!r.ok) continue;
      const data = await r.json();
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!Array.isArray(tracks) || tracks.length === 0) continue;
      // Prefer English, otherwise first available
      const track = tracks.find((t: any) => (t.languageCode || "").startsWith("en")) || tracks[0];
      if (!track?.baseUrl) continue;
      const xmlRes = await fetch(track.baseUrl);
      if (!xmlRes.ok) continue;
      const xml = await xmlRes.text();
      const segs: TranscriptSegment[] = [];
      const re = /<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml)) !== null) {
        const text = m[3]
          .replace(/&amp;/g, "&")
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\n/g, " ")
          .trim();
        if (!text) continue;
        segs.push({
          text,
          offset_ms: Math.round(parseFloat(m[1]) * 1000),
          duration_ms: m[2] ? Math.round(parseFloat(m[2]) * 1000) : 0,
        });
      }
      if (segs.length > 0) return segs;
    } catch (e) {
      console.warn("[innertube] client error", client.clientName, e);
      continue;
    }
  }
  return null;
}

function chunkSegments(segs: TranscriptSegment[], targetWords = 350): {
  text: string; start_seconds: number; end_seconds: number;
}[] {
  const out: { text: string; start_seconds: number; end_seconds: number }[] = [];
  let buf: TranscriptSegment[] = [];
  let words = 0;
  for (const s of segs) {
    buf.push(s);
    words += s.text.split(/\s+/).length;
    if (words >= targetWords) {
      out.push({
        text: buf.map((b) => b.text).join(" "),
        start_seconds: Math.floor(buf[0].offset_ms / 1000),
        end_seconds: Math.floor(
          (buf[buf.length - 1].offset_ms + (buf[buf.length - 1].duration_ms ?? 0)) / 1000,
        ),
      });
      // 1-segment overlap
      buf = [buf[buf.length - 1]];
      words = buf[0].text.split(/\s+/).length;
    }
  }
  if (buf.length > 0) {
    out.push({
      text: buf.map((b) => b.text).join(" "),
      start_seconds: Math.floor(buf[0].offset_ms / 1000),
      end_seconds: Math.floor(
        (buf[buf.length - 1].offset_ms + (buf[buf.length - 1].duration_ms ?? 0)) / 1000,
      ),
    });
  }
  return out;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  // Call Lovable AI Gateway embeddings, dimensions=384
  const r = await fetch(`${AI_GATEWAY}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-embedding-001",
      input: texts,
      dimensions: 384,
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`embeddings failed ${r.status}: ${body}`);
  }
  const data = await r.json();
  return data.data.map((d: any) => d.embedding);
}

async function runIngestWorker(
  admin: ReturnType<typeof createClient>,
  videoId: string,
  youtubeId: string,
  organizationId: string,
) {
  try {
    let segs = await fetchTranscriptViaSupadata(youtubeId);
    if (!segs || segs.length === 0) segs = await fetchTranscriptViaInnertube(youtubeId);
    if (!segs || segs.length === 0) throw new Error("No transcript available");

    const chunks = chunkSegments(segs);
    const totalDuration = Math.floor(
      (segs[segs.length - 1].offset_ms + (segs[segs.length - 1].duration_ms ?? 0)) / 1000,
    );

    await admin.from("content_videos").update({
      ingest_status: "embedding",
      duration_seconds: totalDuration,
    }).eq("id", videoId);

    await admin.from("content_transcript_chunks").delete().eq("video_id", videoId);

    const BATCH = 8;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const vectors = await embedTexts(slice.map((c) => c.text));
      const rows = slice.map((c, idx) => ({
        video_id: videoId,
        organization_id: organizationId,
        chunk_index: i + idx,
        text: c.text,
        start_seconds: c.start_seconds,
        end_seconds: c.end_seconds,
        embedding: vectors[idx] as unknown as string,
      }));
      const ins = await admin.from("content_transcript_chunks").insert(rows);
      if (ins.error) throw ins.error;
    }

    await admin.from("content_videos").update({ ingest_status: "analyzing" }).eq("id", videoId);

    await fetch(`${SUPABASE_URL}/functions/v1/content-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ videoId, organizationId, internal: true }),
    });
  } catch (e: any) {
    console.error("[content-ingest] worker error", e);
    await admin.from("content_videos").update({
      ingest_status: "failed",
      error_message: String(e?.message ?? e),
    }).eq("id", videoId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));

    // Internal retry mode: called by content-retry-failed cron with service key.
    if (body?.internal === true && body?.action === "retry" && body?.videoId) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.includes(SERVICE_KEY)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: v } = await admin
        .from("content_videos")
        .select("id, youtube_id, organization_id, retry_count")
        .eq("id", body.videoId)
        .maybeSingle();
      if (!v) {
        return new Response(JSON.stringify({ error: "Video not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await admin.from("content_videos").update({
        ingest_status: "transcribing",
        error_message: null,
        retry_count: (v.retry_count ?? 0) + 1,
        last_retry_at: new Date().toISOString(),
      }).eq("id", v.id);

      const work = runIngestWorker(admin, v.id as string, v.youtube_id as string, v.organization_id as string);
      // @ts-ignore EdgeRuntime available in Supabase
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
      else await work;

      return new Response(JSON.stringify({ videoId: v.id, retried: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const youtubeUrl: string = body.youtubeUrl;
    const organizationId: string = body.organizationId;
    if (!youtubeUrl || !organizationId) {
      return new Response(JSON.stringify({ error: "youtubeUrl and organizationId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const youtubeId = extractYouTubeId(youtubeUrl);
    if (!youtubeId) {
      return new Response(JSON.stringify({ error: "Invalid YouTube URL" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const oembed = await fetchYouTubeOEmbed(youtubeId);
    const upsert = await admin
      .from("content_videos")
      .upsert({
        organization_id: organizationId,
        youtube_id: youtubeId,
        url: `https://www.youtube.com/watch?v=${youtubeId}`,
        title: oembed?.title ?? youtubeId,
        channel_name: oembed?.author_name ?? null,
        thumbnail_url: oembed?.thumbnail_url ?? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
        ingest_status: "transcribing",
        ingested_by: userId,
        error_message: null,
      }, { onConflict: "organization_id,youtube_id" })
      .select("id")
      .single();
    if (upsert.error) throw upsert.error;
    const videoId = upsert.data.id as string;

    const work = runIngestWorker(admin, videoId, youtubeId, organizationId);
    // @ts-ignore EdgeRuntime is available
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
    else await work;

    return new Response(JSON.stringify({ videoId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[content-ingest] error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

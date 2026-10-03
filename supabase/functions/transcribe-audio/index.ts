// Relays a recorded voice clip to the Lovable AI Gateway transcription endpoint
// and streams the transcript (SSE) back unchanged.
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "x-lovable-aig-run-id",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MODEL = "google/gemini-3.5-transcribe";
const MAX_FILE_BYTES = 13 * 1024 * 1024; // Gemini file cap is 14 MB
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 512 * 1024;

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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userId = getUserIdFromJwt(auth);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const declared = Number(req.headers.get("content-length") ?? "0");
    if (declared > MAX_REQUEST_BYTES) return json({ error: "Recording is too long. Please keep it under 2 minutes." }, 413);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: mem, error: memErr } = await userClient
      .from("organization_members").select("user_id").eq("user_id", userId).limit(1).maybeSingle();
    if (memErr || !mem?.user_id) return json({ error: "Forbidden" }, 403);

    // Bounded read of the body (guards chunked uploads without content-length).
    const reader = req.body?.getReader();
    if (!reader) return json({ error: "No audio received" }, 400);
    const parts: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_REQUEST_BYTES) return json({ error: "Recording is too long. Please keep it under 2 minutes." }, 413);
      parts.push(value);
    }
    const form = await new Response(new Blob(parts), {
      headers: { "Content-Type": req.headers.get("content-type") ?? "" },
    }).formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size < 2048) return json({ error: "Recording was empty — please try again." }, 400);
    if (file.size > MAX_FILE_BYTES) return json({ error: "Recording is too long. Please keep it under 2 minutes." }, 413);
    if (!file.type.startsWith("audio/")) return json({ error: "Unsupported audio type" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Voice transcription is not configured." }, 500);

    const upstreamForm = new FormData();
    upstreamForm.append("model", MODEL);
    upstreamForm.append("file", file, file.name || "recording.wav");
    upstreamForm.append("response_format", "json");
    upstreamForm.append("stream", "true");

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" },
      body: upstreamForm,
      signal: req.signal,
    });

    const headers: Record<string, string> = {
      ...cors,
      // A successful reply is always an event stream (stream=true above). Saying so explicitly lets
      // supabase.functions.invoke hand the browser the raw stream instead of buffering it as text.
      "Content-Type": upstream.ok ? "text/event-stream" : upstream.headers.get("content-type") ?? "application/json",
    };
    upstream.headers.forEach((v, k) => {
      if (k.toLowerCase().startsWith("x-lovable-aig-")) headers[k] = v;
    });
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return new Response(null, { status: 499, headers: cors });
    console.error("transcribe-audio error", e);
    return json({ error: "Transcription failed" }, 500);
  }
});

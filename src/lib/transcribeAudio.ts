import { createParser } from "eventsource-parser";
import { supabase } from "@/integrations/supabase/client";

/** Uploads a WAV clip and streams back the transcript. Calls onText with the text so far. */
export async function transcribeAudio(file: File, onText: (text: string) => void, signal?: AbortSignal): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`https://${projectRef}.supabase.co/functions/v1/transcribe-audio`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal,
  });
  if (!res.ok || !res.body) {
    let msg = `Transcription failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j?.error?.message || j?.error || j?.message || msg;
    } catch { /* ignore */ }
    if (res.status === 402) msg = "AI credits are used up. Add credits to keep using voice input.";
    if (res.status === 429) msg = "Too many requests right now — please try again in a moment.";
    throw new Error(typeof msg === "string" ? msg : "Transcription failed");
  }

  let text = "";
  let finalText: string | null = null;
  let streamError: string | null = null;
  const parser = createParser({
    onEvent(ev) {
      if (!ev.data || ev.data === "[DONE]") return;
      try {
        const j = JSON.parse(ev.data);
        if (j.type === "transcript.text.delta" && typeof j.delta === "string") {
          text += j.delta;
          onText(text);
        } else if (j.type === "transcript.text.done" && typeof j.text === "string") {
          finalText = j.text;
          onText(j.text);
        } else if (j.type === "error" || j.error) {
          streamError = j.error?.message || j.message || "Transcription failed";
        }
      } catch { /* ignore */ }
    },
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    parser.feed(dec.decode(value, { stream: true }));
  }
  if (streamError) throw new Error(streamError);
  const out = (finalText ?? text).trim();
  if (!out) throw new Error("I couldn't hear any words — please try again.");
  return out;
}

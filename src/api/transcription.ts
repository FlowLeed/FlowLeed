import { createParser } from "eventsource-parser";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { ProviderError } from "@/errors/ProviderError";
import { invokeFunction } from "./supabaseFunctions";

// Friendlier wording for the statuses the Lovable AI Gateway passes through.
const STATUS_MESSAGES: Record<number, string> = {
  401: "Please sign in again.",
  402: "AI credits are used up. Add credits to keep using voice input.",
  429: "Too many requests right now — please try again in a moment.",
};

/** Uploads a WAV clip and streams back the transcript. Calls onText with the text so far. */
export async function transcribeAudio(file: File, onText: (text: string) => void): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name);

  let response: Response | null;
  try {
    // The function answers with server-sent events, which invoke hands back as the raw Response.
    response = await invokeFunction<Response>(
      "transcribe-audio",
      { body: form },
      { service: "voice transcription", fallback: "Transcription failed. Please try again." }
    );
  } catch (error) {
    const status = error instanceof ProviderError && error.cause instanceof FunctionsHttpError
      ? error.cause.context.status
      : undefined;
    if (status && STATUS_MESSAGES[status]) throw new ProviderError(STATUS_MESSAGES[status], error);
    throw error;
  }
  if (!response?.body) throw new ProviderError("Transcription failed. Please try again.");

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
      } catch { /* ignore partial events */ }
    },
  });
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    parser.feed(dec.decode(value, { stream: true }));
  }
  if (streamError) throw new ProviderError(streamError);
  const out = (finalText ?? text).trim();
  if (!out) throw new ProviderError("I couldn't hear any words — please try again.");
  return out;
}

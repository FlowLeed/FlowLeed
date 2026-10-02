// Shared Gloo AI client. Gloo's API is OpenAI-compatible, so we call it with the openai SDK.
// Docs: https://docs.gloo.com/api-guides/sdks-and-libraries
// Every Edge Function that talks to Gloo goes through these helpers; none calls the API directly.

import OpenAI from "openai";

const GLOO_BASE_URL = "https://platform.ai.gloo.com/ai/v2/guarded";

// Default chat model — override per call if needed.
export const DEFAULT_GLOO_MODEL = "gloo-google-gemini-3-flash";

export type GlooChatCompletion = OpenAI.Chat.Completions.ChatCompletion;
export type GlooToolCall = OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;

type WithOptionalModel<T> = Omit<T, "model"> & { model?: string };
export type GlooChatParams = WithOptionalModel<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming>;
export type GlooStreamParams = WithOptionalModel<Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming, "stream">>;

let client: OpenAI | null = null;

function glooClient(): OpenAI {
  if (client) return client;
  const apiKey = Deno.env.get("GLOO_API_KEY");
  if (!apiKey) throw new Error("GLOO_API_KEY must be configured");
  client = new OpenAI({ apiKey, baseURL: GLOO_BASE_URL });
  return client;
}

/** A chat completion. Throws on failure; use glooErrorStatus to read the HTTP status. */
export function glooChat(params: GlooChatParams): Promise<GlooChatCompletion> {
  return glooClient().chat.completions.create({ ...params, model: params.model ?? DEFAULT_GLOO_MODEL });
}

/**
 * A streamed chat completion, returned as Gloo's raw server-sent events
 * (`data: {...}` lines ending with `data: [DONE]`) so callers can forward or transform them.
 * Throws before streaming starts if Gloo rejects the request.
 */
export async function glooChatStream(params: GlooStreamParams): Promise<ReadableStream<Uint8Array>> {
  const response = await glooClient().chat.completions
    .create({ ...params, model: params.model ?? DEFAULT_GLOO_MODEL, stream: true })
    .asResponse();
  if (!response.body) throw new Error("Gloo returned an empty stream");
  return response.body;
}

/** The function tool calls in the completion's first choice. */
export function glooToolCalls(completion: GlooChatCompletion): GlooToolCall[] {
  return (completion.choices[0]?.message?.tool_calls ?? [])
    .filter((call): call is GlooToolCall => call.type === "function");
}

/** The HTTP status Gloo answered with (e.g. 429, 402), or undefined for other errors. */
export function glooErrorStatus(error: unknown): number | undefined {
  return error instanceof OpenAI.APIError ? error.status : undefined;
}

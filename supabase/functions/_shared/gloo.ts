// Shared Gloo AI client. Gloo's API is OpenAI-compatible, so we call it with the openai SDK.
// Docs: https://docs.gloo.com/api-guides/sdks-and-libraries
// Every Edge Function that talks to Gloo goes through these helpers; none calls the API directly.

import OpenAI from "openai";

// Chat goes through Gloo's guarded pipeline; embeddings are only served on the direct endpoint.
const GLOO_BASE_URL = "https://platform.ai.gloo.com/ai/v2/guarded";
const GLOO_DIRECT_BASE_URL = "https://platform.ai.gloo.com/ai/v2/direct";

// Default chat model — override per call if needed.
export const DEFAULT_GLOO_MODEL = "gloo-google-gemini-3-flash";

// Content embeddings: the model the Lovable AI Gateway served (google/gemini-embedding-001),
// shortened to the 384 dimensions of the content tables' vector(384) columns. Changing either
// means re-embedding all content.
export const GLOO_EMBEDDING_MODEL = "gloo-google-gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 384;

export type GlooChatCompletion = OpenAI.Chat.Completions.ChatCompletion;
export type GlooToolCall = OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;

type WithOptionalModel<T> = Omit<T, "model"> & { model?: string };
export type GlooChatParams = WithOptionalModel<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming>;
export type GlooStreamParams = WithOptionalModel<Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming, "stream">>;

const clients = new Map<string, OpenAI>();

function glooClient(baseURL = GLOO_BASE_URL): OpenAI {
  const existing = clients.get(baseURL);
  if (existing) return existing;
  const apiKey = Deno.env.get("GLOO_API_KEY");
  if (!apiKey) throw new Error("GLOO_API_KEY must be configured");
  const created = new OpenAI({ apiKey, baseURL });
  clients.set(baseURL, created);
  return created;
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

/**
 * Embeddings for each text, in input order, each EMBEDDING_DIMENSIONS long.
 * Throws if Gloo returns another size, since the content tables can't store it.
 */
export async function glooEmbed(texts: string[]): Promise<number[][]> {
  const res = await glooClient(GLOO_DIRECT_BASE_URL).embeddings.create({
    model: GLOO_EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
    // The SDK otherwise asks for base64 and decodes it; plain floats keep the request simple.
    encoding_format: "float",
  });
  const vectors = res.data.map((d) => d.embedding);
  const wrong = vectors.find((v) => v.length !== EMBEDDING_DIMENSIONS);
  if (wrong) throw new Error(`Gloo returned ${wrong.length}-dimension embeddings; the content tables need ${EMBEDDING_DIMENSIONS}`);
  return vectors;
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

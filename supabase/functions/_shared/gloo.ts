// Shared Gloo AI helper: OAuth2 client-credentials token cache + OpenAI-compatible chat helper.
// Docs: https://docs.gloo.com/api-guides/sdks-and-libraries

const GLOO_TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const GLOO_CHAT_URL = "https://platform.ai.gloo.com/ai/v2/chat/completions";

// Default chat model — override per call if needed.
export const DEFAULT_GLOO_MODEL = "gloo-google-gemini-3-flash";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getGlooAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.token;

  const clientId = Deno.env.get("GLOO_CLIENT_ID");
  const clientSecret = Deno.env.get("GLOO_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("GLOO_CLIENT_ID and GLOO_CLIENT_SECRET must be configured");
  }
  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(GLOO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: "grant_type=client_credentials&scope=api/access",
  });
  if (!res.ok) {
    throw new Error(`Gloo auth failed ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const expiresInMs = ((data.expires_in as number) ?? 3600) * 1000;
  cachedToken = { token: data.access_token, expiresAt: now + expiresInMs };
  return cachedToken.token;
}

export interface GlooChatOptions {
  model?: string;
  messages: Array<{ role: string; content: unknown; tool_call_id?: string; tool_calls?: unknown }>;
  temperature?: number;
  max_tokens?: number;
  tools?: unknown[];
  tool_choice?: unknown;
  response_format?: unknown;
  stream?: boolean;
  [key: string]: unknown;
}

/**
 * OpenAI-compatible chat completion call to Gloo AI (`/ai/v2/chat/completions`).
 * Returns the raw fetch Response so callers can stream or parse JSON as needed.
 */
export async function glooChatFetch(opts: GlooChatOptions): Promise<Response> {
  const token = await getGlooAccessToken();
  const { model, ...rest } = opts;
  return fetch(GLOO_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: model ?? DEFAULT_GLOO_MODEL, ...rest }),
  });
}

/** Convenience: parse a non-streaming Gloo chat completion, throw on error. */
export async function glooChatJson(opts: GlooChatOptions): Promise<any> {
  const r = await glooChatFetch(opts);
  if (!r.ok) throw new Error(`Gloo chat ${r.status}: ${await r.text()}`);
  return r.json();
}

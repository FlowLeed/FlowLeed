// Checks that the AI provider keys in an env file work, before you test the features that use them.
// Makes one small request per provider (a few tokens, one transcript lookup) and never prints a key.
//
//   deno run --allow-net --allow-env --allow-read --config supabase/functions/_shared/deno.json \
//     --env-file=supabase/functions/.env.local scripts/check-ai-providers.ts
//
// --config supplies the import map that _shared/gloo.ts needs for the openai package.
// Providers whose keys aren't set are reported as skipped. Exits with 1 if a configured provider fails.

import { DEFAULT_GLOO_MODEL, glooChat } from "../supabase/functions/_shared/gloo.ts";

// Same values the Edge Functions use (content-ingest, content-search, content-ask, content-chat, content-story-draft).
const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1";
const EMBEDDING_MODEL = "google/gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 384;
const STORY_DRAFT_MODEL = "openai/gpt-6-astra";
// A public YouTube video with captions, used only to confirm the Supadata key.
const SAMPLE_YOUTUBE_ID = "dQw4w9WgXcQ";

type Result = { provider: string; status: "ok" | "failed" | "skipped"; detail: string };

const SECRET_NAMES = ["GLOO_API_KEY", "LOVABLE_API_KEY", "SUPADATA_API_KEY"];

// Some providers echo the key back in their error message (Supadata does), so mask every key value.
function redact(text: string): string {
  return SECRET_NAMES
    .map((name) => Deno.env.get(name))
    .filter((value): value is string => !!value)
    .reduce((out, value) => out.replaceAll(value, "***"), text);
}

async function failure(res: Response): Promise<string> {
  return `${res.status}: ${(await res.text()).slice(0, 200)}`;
}

async function checkGloo(): Promise<Result> {
  const provider = "Gloo AI (Care Agent, Signal Agent, AI suggestions, Content answers)";
  if (!Deno.env.get("GLOO_API_KEY")) {
    return { provider, status: "skipped", detail: "GLOO_API_KEY not set" };
  }
  const data = await glooChat({
    messages: [{ role: "user", content: "Reply with the word ok." }],
    max_tokens: 5,
  });
  if (!data.choices.length) return { provider, status: "failed", detail: "chat returned no choices" };
  return { provider, status: "ok", detail: `${DEFAULT_GLOO_MODEL} answered` };
}

async function checkLovable(): Promise<Result[]> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  const embeddings = "Lovable AI embeddings (Content ingest and search)";
  const drafter = "Lovable AI chat (story drafter)";
  if (!key) {
    const detail = "LOVABLE_API_KEY not set";
    return [{ provider: embeddings, status: "skipped", detail }, { provider: drafter, status: "skipped", detail }];
  }
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  const results: Result[] = [];
  const e = await fetch(`${LOVABLE_GATEWAY}/embeddings`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: ["ping"], dimensions: EMBEDDING_DIMENSIONS }),
  });
  if (!e.ok) {
    results.push({ provider: embeddings, status: "failed", detail: await failure(e) });
  } else {
    const length = (await e.json())?.data?.[0]?.embedding?.length;
    results.push(length === EMBEDDING_DIMENSIONS
      ? { provider: embeddings, status: "ok", detail: `${EMBEDDING_MODEL}, ${length} dimensions` }
      : { provider: embeddings, status: "failed", detail: `expected ${EMBEDDING_DIMENSIONS} dimensions, got ${length}` });
  }

  const c = await fetch(`${LOVABLE_GATEWAY}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: STORY_DRAFT_MODEL, messages: [{ role: "user", content: "Reply with the word ok." }], max_tokens: 5 }),
  });
  results.push(c.ok
    ? { provider: drafter, status: "ok", detail: `${STORY_DRAFT_MODEL} answered` }
    : { provider: drafter, status: "failed", detail: await failure(c) });
  return results;
}

async function checkSupadata(): Promise<Result> {
  const provider = "Supadata (YouTube transcripts for Content ingest)";
  const key = Deno.env.get("SUPADATA_API_KEY");
  if (!key) return { provider, status: "skipped", detail: "SUPADATA_API_KEY not set" };
  const r = await fetch(`https://api.supadata.ai/v1/youtube/transcript?videoId=${SAMPLE_YOUTUBE_ID}&text=false`, {
    headers: { "x-api-key": key },
  });
  if (!r.ok) return { provider, status: "failed", detail: await failure(r) };
  const data = await r.json();
  const segments = (data.content ?? data.transcript ?? []).length;
  return segments > 0
    ? { provider, status: "ok", detail: `${segments} transcript segments returned` }
    : { provider, status: "failed", detail: "no transcript segments returned" };
}

async function run(check: () => Promise<Result | Result[]>, provider: string): Promise<Result[]> {
  try {
    const r = await check();
    return Array.isArray(r) ? r : [r];
  } catch (e) {
    return [{ provider, status: "failed", detail: (e as Error).message.slice(0, 200) }];
  }
}

const results = [
  ...await run(checkGloo, "Gloo AI"),
  ...await run(checkLovable, "Lovable AI"),
  ...await run(checkSupadata, "Supadata"),
];

const mark = { ok: "OK     ", failed: "FAILED ", skipped: "SKIPPED" };
for (const r of results) console.log(`${mark[r.status]} ${r.provider}\n        ${redact(r.detail)}`);
if (results.some((r) => r.status === "failed")) Deno.exit(1);

// Checks that the AI provider keys in an env file work, before you test the features that use them.
// Makes one small request per provider (a few tokens, one transcript lookup) and never prints a key.
//
//   deno run --allow-net --allow-env --allow-read --config supabase/functions/_shared/deno.json \
//     --env-file=supabase/functions/.env.local scripts/check-ai-providers.ts
//
// --config supplies the import map that _shared/gloo.ts needs for the openai package.
// Providers whose keys aren't set are reported as skipped. Exits with 1 if a configured provider fails.

import {
  DEFAULT_GLOO_MODEL,
  EMBEDDING_DIMENSIONS,
  GLOO_EMBEDDING_MODEL,
  glooChat,
  glooEmbed,
} from "../supabase/functions/_shared/gloo.ts";

// The model the morning briefing (care-agent-run) and the story drafter (content-story-draft) use.
const WRITING_MODEL = "gloo-openai-gpt-6-astra";
// A public YouTube video with captions, used only to confirm the Supadata key.
const SAMPLE_YOUTUBE_ID = "dQw4w9WgXcQ";

type Result = { provider: string; status: "ok" | "failed" | "skipped"; detail: string };

const SECRET_NAMES = ["GLOO_API_KEY", "SUPADATA_API_KEY"];

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

const glooSkipped = (provider: string): Result | null =>
  Deno.env.get("GLOO_API_KEY") ? null : { provider, status: "skipped", detail: "GLOO_API_KEY not set" };

async function checkGlooChat(model: string, provider: string): Promise<Result> {
  const skipped = glooSkipped(provider);
  if (skipped) return skipped;
  const data = await glooChat({ model, messages: [{ role: "user", content: "Reply with the word ok." }], max_tokens: 5 });
  if (!data.choices.length) return { provider, status: "failed", detail: "chat returned no choices" };
  return { provider, status: "ok", detail: `${model} answered` };
}

async function checkGlooEmbeddings(): Promise<Result> {
  const provider = "Gloo AI embeddings (Content ingest, search, ask and chat)";
  const skipped = glooSkipped(provider);
  if (skipped) return skipped;
  try {
    // glooEmbed throws unless every vector has EMBEDDING_DIMENSIONS values.
    await glooEmbed(["ping"]);
    return { provider, status: "ok", detail: `${GLOO_EMBEDDING_MODEL}, ${EMBEDDING_DIMENSIONS} dimensions` };
  } catch (e) {
    const message = (e as Error).message;
    const hint = message.includes("-dimension embeddings")
      ? " — this model ignores the dimensions setting; switch GLOO_EMBEDDING_MODEL in _shared/gloo.ts to gloo-openai-text-embedding-3-small"
      : "";
    return { provider, status: "failed", detail: message.slice(0, 200) + hint };
  }
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

const CHAT = "Gloo AI chat (Care Agent, Signal Agent, suggestions, Content answers)";
const WRITING = "Gloo AI chat (morning briefing, story drafter)";
const results = [
  ...await run(() => checkGlooChat(DEFAULT_GLOO_MODEL, CHAT), CHAT),
  ...await run(() => checkGlooChat(WRITING_MODEL, WRITING), WRITING),
  ...await run(checkGlooEmbeddings, "Gloo AI embeddings"),
  ...await run(checkSupadata, "Supadata"),
];

const mark = { ok: "OK     ", failed: "FAILED ", skipped: "SKIPPED" };
for (const r of results) console.log(`${mark[r.status]} ${r.provider}\n        ${redact(r.detail)}`);
if (results.some((r) => r.status === "failed")) Deno.exit(1);

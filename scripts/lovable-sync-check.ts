// Lists what a batch of Lovable changes needs before it can land on our lovable branch, following AGENTS.md.
// Read-only: it only runs git. Fetch first so the refs are current.
//
//   git fetch lova && git fetch origin
//   deno run --allow-run=git scripts/lovable-sync-check.ts [head=lova/main] [ours=origin/lovable] [--base=<ref>]
//
// Without --base, it checks everything on <head> since <head> and <ours> last met (git merge-base).

const args = Deno.args.filter((a) => !a.startsWith("--"));
const HEAD = args[0] ?? "lova/main";
const OURS = args[1] ?? "origin/lovable";

function git(...cmd: string[]): string {
  const { stdout } = new Deno.Command("git", { args: cmd, stdout: "piped", stderr: "null" }).outputSync();
  return new TextDecoder().decode(stdout);
}

const show = (ref: string, path: string) => git("show", `${ref}:${path}`);
const BASE = Deno.args.find((a) => a.startsWith("--base="))?.slice(7) ?? git("merge-base", OURS, HEAD).trim();
if (!BASE) {
  console.error(`${HEAD} and ${OURS} share no history: compare snapshots instead of merging.`);
  Deno.exit(1);
}

function addedLines(path: string): string[] {
  return git("diff", "-U0", BASE, HEAD, "--", path).split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1));
}

// path -> A (added), M (modified), D (deleted) or R (renamed)
const files = new Map<string, string>(
  git("diff", "--name-status", "-M", BASE, HEAD).split("\n").filter(Boolean)
    .map((line) => { const parts = line.split("\t"); return [parts[parts.length - 1], parts[0][0]]; }),
);
const findings = new Map<string, string[]>();
const add = (section: string, item: string) => findings.set(section, [...(findings.get(section) ?? []), item]);

const PROTECTED: [RegExp, string][] = [
  [/^\.env$/, "keep ours (staging public values); Lovable's has production values"],
  [/^\.env\./, "keep ours"],
  [/^supabase\/functions\/\.env/, "keep ours (only add new names to .env.example)"],
  [/^src\/integrations\/supabase\/client\.ts$/, "keep ours (reads env vars)"],
  [/^src\/integrations\/supabase\/types\.ts$/, "regenerate from our migrations; Lovable's comes from production"],
  [/^supabase\/migrations\/20260930000000_baseline\.sql$/, "keep ours"],
  [/^supabase\/migrations_archive\//, "keep ours"],
  [/^supabase\/seed\.sql$/, "keep ours"],
  [/^supabase\/config\.toml$/, "keep ours; copy over only new [functions.x] entries"],
  [/^\.github\//, "keep ours"],
  [/^wrangler\.jsonc$|^public\/_headers$/, "keep ours"],
  [/^supabase\/functions\/_shared\/gloo\.ts$/, "keep ours (openai SDK + GLOO_API_KEY)"],
  [/^package-lock\.json$|^bun\.lockb$/, "delete again: bun.lock is the only lockfile"],
];
const isProtected = (path: string) => PROTECTED.some(([re]) => re.test(path));
for (const [path, status] of files) {
  for (const [re, action] of PROTECTED) if (re.test(path)) add("Protected files (resolve to our version)", `${status} ${path}: ${action}`);
}

// Migrations
const PROJECT_URL = /https?:\/\/[a-z0-9]{20}\.supabase\.co/;
const ourLatest = git("ls-tree", "--name-only", OURS, "supabase/migrations/").split("\n")
  .map((p) => p.split("/").pop() ?? "").filter((n) => /^\d{14}_/.test(n)).map((n) => n.slice(0, 14)).sort().pop() ?? "0";
for (const [path, status] of files) {
  if (!/^supabase\/migrations\/\d{14}_.*\.sql$/.test(path) || status === "D") continue;
  const name = path.split("/").pop()!;
  const sql = show(HEAD, path);
  const notes: string[] = [];
  if (name.slice(0, 14) <= ourLatest) notes.push(`dated before our newest migration (${ourLatest}): archive it if the baseline already has it, otherwise rename it to a later timestamp`);
  if (PROJECT_URL.test(sql) || /eyJ[A-Za-z0-9_-]{10,}\./.test(sql)) notes.push("hard-coded project URL or key");
  if (/net\.http_(post|get)/.test(sql)) notes.push("calls net.http_*: use private.invoke_edge_function");
  if (/cron\.schedule/.test(sql) && !sql.includes("private.invoke_edge_function")) notes.push("cron.schedule without the Vault helper");
  if (/vault\.create_secret\s*\(\s*'/.test(sql)) notes.push("vault.create_secret with a value");
  for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?"?(\w+)"?/gi)) {
    if (!new RegExp(`ALTER TABLE (?:public\\.)?"?${m[1]}"? ENABLE ROW LEVEL SECURITY`, "i").test(sql)) notes.push(`table ${m[1]} created without RLS`);
  }
  add("Migrations", `${status} ${name}${notes.length ? notes.map((n) => `\n      - ${n}`).join("") : ": no issues"}`);
}

// Edge Functions
const ourConfig = show(OURS, "supabase/config.toml");
const functionNames = [...new Set([...files.keys()]
  .map((p) => p.match(/^supabase\/functions\/([^_/][^/]*)\//)?.[1]).filter((n): n is string => !!n))].sort();
for (const fn of functionNames) {
  const index = show(HEAD, `supabase/functions/${fn}/index.ts`);
  if (!index) continue;
  const status = files.get(`supabase/functions/${fn}/index.ts`) ?? "M";
  const notes: string[] = [];
  if (!show(HEAD, `supabase/functions/${fn}/deno.json`) && !show(OURS, `supabase/functions/${fn}/deno.json`)) notes.push("no deno.json");
  if (/esm\.sh|deno\.land\//.test(index)) notes.push("URL imports (esm.sh / deno.land): use bare specifiers + deno.json");
  if (/from ['"](std\/http|https:\/\/deno\.land\/std[^'"]*\/http)/.test(index) || /^serve\(/m.test(index)) notes.push("std/http serve: use Deno.serve");
  if (/['"]xhr['"]|deno\.land\/x\/xhr/.test(index)) notes.push("xhr polyfill");
  if (/getGlooAccessToken|GLOO_CLIENT_|platform\.ai\.gloo\.com/.test(index)) notes.push("old Gloo auth or direct Gloo URL: use the _shared/gloo.ts helpers");
  if (/ai\.gateway\.lovable\.dev|LOVABLE_API_KEY/.test(index)) notes.push("Lovable AI Gateway: we have no Lovable key; move it to Gloo (_shared/gloo.ts: glooChat, glooEmbed)");
  if (status === "A" && !ourConfig.includes(`[functions.${fn}]`)) notes.push(`new function with no [functions.${fn}] entry in our config.toml (copy Lovable's verify_jwt)`);
  add("Edge Functions", `${status} ${fn}${notes.length ? notes.map((n) => `\n      - ${n}`).join("") : ": no issues"}`);
}

// Hard-coded values in added lines. Matched lines are shortened so a real key is never printed whole.
const HARD_CODED: [string, RegExp][] = [
  ["JWT", /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["Supabase project URL", PROJECT_URL],
  ["Lovable app address", /[\w-]+\.lovable(project)?\.(app|com)/],
  ["API key", /\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{16,}|\bsk-[A-Za-z0-9_-]{20,}|\bre_[A-Za-z0-9_]{20,}|\bAIza[0-9A-Za-z_-]{35}\b/],
  ["secret assignment", /(secret|password|api[_-]?key|token)\w*\s*[:=]\s*['"][^'"\s${}]{12,}['"]/i],
];
for (const [path, status] of files) {
  if (status === "D" || path.startsWith("supabase/migrations_archive/") || /\.(lock|lockb|png|jpe?g|svg|ico)$/.test(path)) continue;
  for (const line of addedLines(path)) {
    for (const [label, re] of HARD_CODED) {
      const match = line.match(re);
      if (match) add("Hard-coded values in added lines", `${path}: ${label} (${match[0].slice(0, 12)}…)`);
    }
  }
}

// Web app: direct Edge Function calls. Flagged only; moving them into src/api is a separate decision.
for (const [path, status] of files) {
  if (!/^src\/(pages|components)\/.*\.tsx?$/.test(path) || status === "D") continue;
  const calls = addedLines(path).filter((l) => /supabase\.functions\.invoke|\/functions\/v1\//.test(l)).length;
  if (calls) add("Web app: direct Edge Function calls (flag only)", `${path}: ${calls} call(s)`);
}

// Web app: anything that still expects the Lovable AI Gateway or server-side transcription.
for (const [path, status] of files) {
  if (!/^src\/.*\.tsx?$/.test(path) || status === "D") continue;
  if (addedLines(path).some((l) => /ai\.gateway\.lovable\.dev|transcribe-audio/.test(l))) {
    add("Edge Functions", `${status} ${path}
      - uses the Lovable AI Gateway or transcribe-audio: voice notes use useSpeechRecognition, all AI goes through Gloo`);
  }
}

if (files.has("package.json")) {
  add("Dependencies", `package.json changed${files.has("bun.lock") ? "" : "; bun.lock did NOT change: run bun install"}`);
}

const commits = git("log", "--format=%h", `${BASE}..${HEAD}`).split("\n").filter(Boolean).length;
console.log(`Lovable changes ${BASE.slice(0, 8)}..${HEAD}: ${commits} commits, ${files.size} files (ours: ${OURS})`);
for (const section of ["Protected files (resolve to our version)", "Migrations", "Edge Functions", "Hard-coded values in added lines",
  "Web app: direct Edge Function calls (flag only)", "Dependencies"]) {
  const items = findings.get(section) ?? [];
  console.log(`\n## ${section} (${items.length})`);
  for (const item of items) console.log(`  ${item}`);
}
const other = [...files].filter(([p]) => !isProtected(p) && !p.startsWith("supabase/migrations/") && !p.startsWith("supabase/functions/"));
console.log(`\n## Other files (${other.length}): merge as-is after review`);
for (const [p, s] of other) console.log(`  ${s} ${p}`);

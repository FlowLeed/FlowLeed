
# Content Module — Plan

A new feature module inside Flowleed that ingests YouTube videos, extracts narrative "stories" with AI, and lets teams search and chat with them semantically. Gated per-org via the existing feature-module toggle (alongside Signals, Texting, Calling, Flowleed AI).

## Scope (v1)

Shipping all four selected scopes in v1:
1. Ingest + transcript + AI analysis + per-video chat
2. Semantic search page with filters
3. Cross-library RAG chat
4. Public cross-org search (org-scoped public page, like Groups public view)

## 1. Feature gating

Add `"content"` to `FeatureKey` and `FEATURE_MODULES` in `src/lib/features.ts` (icon: `Film`/`Video`). All `/content/*` routes wrap with `<FeatureGate feature="content">`. Sidebar entry hidden unless enabled. Default = ON for backward compatibility (per existing convention), toggleable from `fl-admin → Organization Detail → Feature Modules`.

## 2. Routes (under the existing shell)

```text
/content                          Dashboard (search bar hero + recent videos)
/content/search                   Semantic search with filters
/content/videos/:id               Detail view (Overview · Transcript · Quotes · Chat)
/content/chat                     Cross-library RAG chat
/content/library                  All ingested videos (table + filters)
/org/:slug/content                Public org page (consent_level=public_search videos)
```

All wired with TanStack Query, lazy-loaded in `App.tsx` like the rest.

## 3. Database (single migration)

Enable `pgvector`. Enums: `consent_level` (`internal_use`, `public_search`).

Tables (all in `public`, all with GRANTs + RLS + `has_role`/`is_org_member` policies):

- `content_videos` — `organization_id`, `youtube_id` (unique per org), `title`, `channel_name`, `channel_id`, `duration_seconds`, `published_at`, `thumbnail_url`, `description`, `consent_level` (default `internal_use`), `ingested_by`, `ingest_status` (`pending|transcribing|analyzing|ready|failed`), `error_message`
- `content_transcript_chunks` — `video_id`, `organization_id`, `chunk_index`, `text`, `time_range tsrange` (start/end seconds as int), `start_seconds`, `end_seconds`, `embedding vector(384)`. HNSW index on `embedding vector_cosine_ops`.
- `content_analyses` — `video_id`, `organization_id`, `summary`, `themes text[]`, `story_patterns jsonb`, `key_quotes jsonb` (`{text, start_seconds, impact_score}[]`), `impact_score smallint`, `model`, `generated_at`. One row per (video, version); newest wins.
- `content_chat_sessions` — `user_id`, `organization_id`, `video_id` nullable (null = cross-library), `title`.
- `content_chat_messages` — `session_id`, `role`, `content`, `citations jsonb` (`{video_id, chunk_id, start_seconds, snippet, thumbnail_url}[]`).

RPC: `match_content_chunks(query_embedding vector(384), p_org_id uuid, p_video_id uuid default null, threshold float default 0.5, match_count int default 8)` — security definer, returns ranked chunks scoped to org (and video if provided), plus a public variant `match_content_chunks_public` that scopes to `consent_level='public_search'` for the public org page.

## 4. Edge functions

- `content-ingest` — input: `{ youtubeUrl, organizationId }`. Resolves video metadata, creates `content_videos` row (status=`transcribing`), kicks off transcript fetch → chunking → embedding → analysis sequentially. Returns `videoId`.
- `content-transcript` — Supadata primary (`SUPADATA_API_KEY`), Innertube multi-client rotation fallback (`WEB`, `ANDROID`, `IOS`, `TVHTML5`). Stores chunks (~500 tokens, ~50 overlap).
- `content-embed` — calls Lovable AI Gateway `google/gemini-embedding-001` with `dimensions: 384`, batches per chunk sequentially to respect CPU limits.
- `content-analyze` — Gemini 3 Flash; structured output (themes, story patterns, key quotes w/ timestamps, impact 1–10). Re-runnable. Writes a new `content_analyses` row.
- `content-chat` — streaming. Embeds query → `match_content_chunks` → prompts Gemini with citations → streams response. Accepts `videoId?` for per-video vs cross-library.

All functions verify JWT in code (`getClaims`), scope every query by `organization_id` from the user's membership.

## 5. UI

Shared Flowleed shell + design tokens. Search bar is the visual anchor.

- **Dashboard** — empty state: "Paste your first YouTube URL". Past that, a hero search input + recent videos grid.
- **Search results** — quiet cards: thumbnail, title, channel, matched quote with `MM:SS` (exact) or `~MM:SS` (estimated), impact badge, deep link `/content/videos/:id?t=123`.
- **Video detail** — YouTube embed (postMessage API) synced to transcript; tabs Overview / Transcript / Quotes / Chat. "Regenerate analysis" button. Consent toggles (`internal_use` / `public_search`) for org admins.
- **Cross-library chat** — full-page chat with citation cards (64×64 thumb, 3-line quote, deep link).
- **Public org page** `/org/:slug/content` — read-only, only `public_search` videos, no chat.

## 6. Secrets

- `SUPADATA_API_KEY` — request via `add_secret` in build mode.
- `LOVABLE_API_KEY` — already provisioned; used for both embeddings and analysis.

## 7. Open question for build time

Brand tokens: confirm the existing Flowleed tokens (primary, accent, fonts) — I'll inherit from current `index.css` unless you want a new accent specifically for Content.

## Out of scope (explicit)

- Channel-level subscriptions / auto-ingest of new uploads (manual paste only).
- Multi-language transcript translation.
- Audio/podcast ingestion (YouTube only).
- Billing/quota per org for ingest volume.

## Technical notes

- Embeddings: Gemini `embedding-001` with `dimensions: 384` (truncated). HNSW cosine index.
- Chunking: ~500 tokens with ~50 overlap, preserving sentence boundaries; `tsrange` stores second-level start/end.
- Inline sequential processing inside edge functions to stay under CPU limits; status field surfaces progress to UI via TanStack Query polling.
- All RLS policies use `organization_members` + `has_role` helpers already present in the schema, mirroring `groups` patterns.
- Public page uses a SECURITY DEFINER RPC restricted to `consent_level='public_search'` and an org slug; no auth required.

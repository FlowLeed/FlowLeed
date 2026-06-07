## Goal

Let users type `@` in the dashboard AI chat to open a small dropdown that searches contacts by name. Selecting one inserts the contact's name as a mention token (e.g. `@Alexa Yarmolatii`) and attaches their ID as context so the AI answers about the right person.

## UX

- In `AIChatInput.tsx` textarea, when the user types `@` (at start or after whitespace), a floating dropdown appears anchored under the caret.
- Dropdown shows up to 6 contacts with avatar, name, and email/phone subtitle — same data source as global search (`search_visible_contacts` RPC).
- As the user keeps typing (`@alex...`), the query updates with debounce (~150ms).
- Keyboard: ↑/↓ to navigate, Enter/Tab to select, Esc to close. Mouse click also selects.
- On select: replace the `@query` fragment with `@Full Name ` (trailing space) and track the contact ID in a `mentions` array tied to that token.
- Backspacing into a mention removes the whole token + its entry from `mentions`.
- Dropdown closes if the user types a space without selecting, or moves the caret out of the trigger.

## Context wiring

- `AIChatInput.onSubmit` signature becomes `(message: string, mentions: { id: string; name: string }[])`.
- `ChatThread` / `Dashboard` pass mentions through to `useDashboardChat.sendMessage`.
- `useDashboardChat` appends a hidden context line to the outgoing payload, e.g. prepending a system-style note: `Referenced contacts: [{id, name}, ...]` so the edge function/AI can resolve who the user means. No backend changes required — the existing `dashboard-ai-chat` function already receives the messages array; we just enrich the user message body or add it to a `context` field if the function supports it (verify in the function before finalizing).

## Files to change / add

- `src/components/dashboard/AIChatInput.tsx` — add mention detection, dropdown rendering, keyboard handling, mentions state, updated submit signature.
- `src/components/dashboard/MentionDropdown.tsx` (new) — presentational dropdown (avatar + name + subtitle), reuses `search_visible_contacts` via a small inline hook.
- `src/hooks/useMentionSearch.tsx` (new) — debounced wrapper around `supabase.rpc('search_visible_contacts', ...)` returning `{ id, name, avatar, email }[]`.
- `src/components/dashboard/ChatThread.tsx` and `src/pages/Dashboard.tsx` (or wherever `AIChatInput` is rendered) — forward the new `mentions` arg.
- `src/hooks/useDashboardChat.tsx` — accept `mentions`, include them in the outbound message (prepend a short `[Context: @Name (id: ...)]` line to the user content, or pass as a separate field if we extend the edge function in a follow-up).

## Out of scope

- Mentioning flows, groups, or tasks (only people for now).
- Rendering mentions as styled chips inside the textarea — we keep it as plain `@Name` text with the dropdown helping discovery. A chip-style editor (contenteditable / Tiptap) can be a follow-up if you want richer visuals.
- Editing the `dashboard-ai-chat` edge function — if you want the AI to receive structured mention IDs (not just names in the text), I'll do that in a second pass.

## Question before building

Do you want mentions rendered as styled blue chips (requires switching the textarea to a contenteditable / Tiptap editor — bigger change), or is plain `@Name` text inside the existing textarea fine for v1?

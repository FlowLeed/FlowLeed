# Fix the FlowLeed AI people finder (empty answer + wrong 37 people)

## What went wrong

Three separate problems combined:

1. **No answer text.** The assistant found people, then produced an empty reply. The button you saw is drawn from a hidden marker attached to the result, so when the model returns no words you get a button and nothing else. The list of names the finder actually produced is never shown to you — only the model's paraphrase, and this time there was none.

2. **It couldn't understand half your question.** The people finder supports only: flow moment, Planning Center membership, in/not in a group, serving length, engagement level, campus. It has **no gender filter** and **no "was in a group earlier this year" history filter**. Those two parts of your question were silently dropped, so it answered a different, much broader question — which is why you got mixed genders and campuses. It never says "I can't filter by that".

3. **No preview before acting.** The Add-to-Flow dialog jumps straight to picking a Flow and a step; it never lists the people, so there is no chance to review or drop names before they land in your Flow.

Also found while investigating: the "markers" filter is broken (it queries columns that don't exist), so any question relying on a signal silently returns nothing.

## What we'll change

### 1. Never answer with a bare button
- If the model returns no text after looking people up, fall back to showing the finder's own result: a one-line summary plus the matching names (each linking to the person).
- Always print, above the results, the criteria that were actually applied — e.g. "Campus: Fairfield · Gender: Female · In a group since Jan 1 · Not in an active group now".

### 2. Teach the finder the missing questions
Add these filters:
- **Gender** (from Planning Center demographics).
- **Group participation history**: was an active group member / attended a group meeting between two dates ("earlier this year").
- **Not in an active group right now** (already exists, made explicit and combinable with the above).
- Stricter campus handling: if the campus name doesn't resolve, ask instead of ignoring it.
- Fix the broken signal/marker filter.

### 3. Say when it can't do something
- The finder returns any criteria it could not honor, and the assistant must state them plainly and offer to refine, instead of quietly answering a wider question.
- The assistant asks a clarifying question when a request contains a filter it has no data for.

### 4. Review the people before they enter a Flow
Add a first "Review people" step to the Add-to-Flow dialog opened from chat:
- Lists every matched person (name, campus, email) with a checkbox, all selected by default.
- Search box, "select none/all", and a live count on the continue button.
- Only after you continue do you pick the Flow and step, and only the people still checked get added.

## Technical notes

- `supabase/functions/dashboard-ai-chat/index.ts`
  - `find_contacts_by_criteria` schema + `executeFindContactsByCriteria`: new args `gender`, `in_group_between: {from,to}`, `not_in_active_group`, and a returned `unsupported_criteria` note. Gender via `contact_demographics.gender`; group history via `group_members.joined_at`/`last_attended_at` plus `group_attendance` joined through `group_meetings`, all org-scoped and paged in chunks (PostgREST caps rows at ~1000, so intersecting id sets must be fetched with the existing chunked pattern).
  - Fix marker filter: `marker_definitions` has `key` (no `id`/`code`); `contact_markers` matches on `marker_key` + `organization_id`.
  - Emit an applied-criteria line and keep the hidden `<!--flowleed:contact_ids=...-->` marker.
  - Streaming wrapper: track whether any content delta was seen; if none, inject the last tool result (criteria line + names) before `[DONE]`.
  - System prompt: require restating criteria, require declaring unsupported filters, forbid answering a narrower/wider question silently.
- `src/components/contacts/BulkAddToFlowDialog.tsx`: new `review` step (fetch `contacts` by id with campus name, checkbox list, search), local `selectedIds` used for the insert; `step` becomes `'review' | 'pipeline' | 'stage'`, with review shown only when the dialog is opened from chat (new `reviewFirst` prop passed by `ChatThread`).
- `src/components/dashboard/ChatThread.tsx`: pass `reviewFirst`, and label the button "Review 37 people" rather than "Add 37 people to a Flow".

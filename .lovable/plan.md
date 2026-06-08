# Smart list builder for the dashboard AI

Goal: let the AI answer compound questions like *"people who were baptized, are members, served 3+ months, and are in groups"* and let you push that result into any flow with one click.

## What we'll build

### 1. New AI tool: `find_contacts_by_criteria`

Add a third tool to `supabase/functions/dashboard-ai-chat/index.ts` that filters contacts by any combination of:

- **Flow moments** (the church's own "next steps" vocabulary)
  - e.g. has moment "Baptism", "Salvation", "Welcome Party", etc.
  - matched by moment-type name (case-insensitive) so the AI can use the church's own words
- **PCO membership status** (e.g. `Member`, `Regular Attender`, `Guest`)
- **Groups**
  - currently in any active group, in a specific group, or in a group for ≥ N days
- **Serving**
  - served in last N days, or first serve ≥ N days ago (handles "served at least 3 months")
- **Engagement markers** (any from `marker_definitions`)
- **Campus**
- **Engagement level** (highly_engaged / active / at_risk / inactive)

Returns: up to 50 contacts as a markdown list **plus** a machine-readable JSON block at the end so the UI can render an action bar.

### 2. Sync PCO membership status

Today `contacts` has no membership field. We'll:

- Add `pc_membership text` to `contacts`
- Update the PCO people sync (`pco-people-sync` / processor) to pull `attributes.membership` and upsert it
- Backfill on next sync; surface it on the contact profile demographics card

### 3. "Add results to a Flow" action in the chat

When the AI returns a list via `find_contacts_by_criteria`, the assistant message renders:

- The markdown list of names (linked to profiles)
- An **"Add all to flow…"** button under the message
- Clicking it opens the existing `BulkAddToFlowDialog` pre-loaded with the contact IDs from that tool call

Technically: the tool emits a hidden `<!--flowleed:contact_ids=[...]-->` marker in its output. `ChatThread` parses it, hides the marker from display, and renders the action bar.

### 4. Prompt updates

Expand the system prompt in `dashboard-ai-chat` so the model knows:
- Flow moments are the canonical "next steps" language
- "Member" → filter by `pc_membership = 'Member'`
- "Served at least 3 months" → `first_serve_before_days = 90`
- Always offer the "Add to flow" follow-up after returning a list

## Technical details

- DB migration: `ALTER TABLE contacts ADD COLUMN pc_membership text;` + index on `(organization_id, pc_membership)`
- Edge function: tool implementation queries `contacts` joined with `flow_moments`, `flow_moment_types`, `group_members`, `pco_checkins` (for serving), `contact_markers`, `contact_engagement_scores`; org-scoped via the caller's `organization_id`
- PCO sync: small patch to where person attributes are mapped — read `attributes.membership`
- Frontend: `ChatThread.tsx` parses the contact-id marker; new lightweight `ChatResultActions` component shows "Add X people to flow…" → reuses `BulkAddToFlowDialog`
- No new RLS surface — tool runs under the caller's auth and filters by their organization

## Out of scope (for this pass)

- Saved/named segments — we can add later if you want recurring lists
- CSV export of the result — easy follow-up
- Filtering by giving (no giving data synced yet)

Once you approve, I'll ship the migration, edge function tool, PCO sync patch, and the chat action UI together.
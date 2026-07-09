## Goal

Turn Signals from a static catalog into a system pastors can shape, and add an AI agent that watches those signals and proposes actions (notify, add to flow, task, draft message) — always as suggestions a human approves. No auto-actions in v1.

## Part 1 — Custom Signals (rule builder)

Reuse the same pattern we just shipped for Moment rules (bracket-style AND/OR builder), so the UX is already familiar.

**New tables**
- `custom_signals` — `id, organization_id, key, label, description, polarity (positive|neutral|negative), category, severity (info|watch|risk), enabled, created_by, created_at`.
- `custom_signal_rules` — one row per signal: `signal_id, rule_combinator (AND|OR), conditions jsonb` (same shape as `pco_moment_mappings.condition_group`).
- `custom_signal_contacts` — materialized results: `signal_id, contact_id, matched_at, cleared_at`. Indexed on `(organization_id, signal_id, contact_id)`.

**Condition sources** (same operators the Moment builder already knows):
- Attendance: `last_service_days_ago`, `services_last_N_weeks`, `is_first_time_guest`
- Groups: `is_in_group`, `group_attendance_rate_last_N`, `days_since_group_meeting`
- Serving: `serves_last_N_days`, `days_since_last_serve`
- Flows: `in_flow(flow_id)`, `days_in_current_stage`, `has_moment(type)`
- Tags: `has_tag`, `not_has_tag`
- PCO custom fields: `field = / contains / has_any_value / date_before / date_after` (already wired for Moments)
- Demographics: `age_between`, `campus_id`, `assigned_user_id`

**UI**
- New page `/signals/custom` (linked from a "New signal" button on `/signals`).
- List of the org's custom signals with polarity chip, contact count, enabled toggle, edit/delete.
- Editor reuses `MomentRuleCard` visually: signal metadata (label, description, polarity, severity, category) on top, bracket builder below.
- Live "matching contacts" preview (top 10) while editing, computed via a `preview-custom-signal` edge function.

**Evaluation**
- Edge function `evaluate-custom-signals` runs the rules per org and upserts `custom_signal_contacts` (sets `cleared_at` when a contact no longer matches).
- Runs on a `pg_cron` schedule (hourly) + on-demand from the UI ("Recompute").
- Custom signals show up in the existing `/signals` catalog alongside built-ins, and on each contact profile in `ActiveMarkersCard`.

## Part 2 — AI Signal Agent ("Pastor Copilot")

An agent that reviews signals continuously and posts **suggestions** into a review queue. It never sends messages, never adds to flows, and never creates tasks on its own — a leader approves each suggestion.

**New tables**
- `signal_agent_configs` — per-org: `enabled, watch_signals (jsonb: list of built-in marker keys + custom_signal ids), allowed_actions (notify|add_to_flow|create_task|draft_message), default_assignee_strategy (assigned_user | campus_pastor | flow_owner), quiet_hours, max_suggestions_per_day`.
- `signal_agent_rules` — optional per-signal recipe overrides: `signal_key, suggested_action, action_params jsonb` (e.g. `Drifting` → `add_to_flow: <re-engagement flow id>`; `First-time guest` → `create_task: "Call within 48h"`).
- `signal_agent_suggestions` — the queue: `id, org_id, contact_id, signal_key, action_type, action_payload jsonb, reasoning text, confidence, status (pending|approved|dismissed|expired), reviewer_id, reviewed_at, executed_at, created_at`.

**Triggers**
- **Real-time**: DB trigger on `contact_markers` + `custom_signal_contacts` inserts/updates → enqueue into `signal_agent_queue`; worker edge function processes the queue.
- **Daily sweep**: `pg_cron` at 7am org-local — agent re-scores all watched contacts and emits/refreshes suggestions for the day.

**Agent implementation**
- Edge function `signal-agent-run` using AI SDK + Lovable AI Gateway (`google/gemini-3.5-flash` — cheap, fast, good enough for classification/reasoning at scale).
- Input per contact: active markers, custom signals, recent interactions, current flows, assigned leader, campus.
- Output (structured via AI SDK `Output.object`): `{ suggestions: [{ action_type, action_payload, reasoning, confidence }] }`. Schema is small — no `.min/.max`, just enums for action_type.
- Guardrails: dedupe against pending suggestions for same (contact, signal, action_type) in last 7 days; respect `max_suggestions_per_day`; skip contacts who already have an active flow of the target type.

**Review UI**
- New page `/signals/agent` with two tabs:
  1. **Queue** — pending suggestions grouped by signal, each card shows: contact, signal reason, proposed action, AI reasoning, "Approve" / "Dismiss" / "Edit". Approving executes the action (calls existing flow-enrollment, task-creation, or message-draft code paths). Dismissing records feedback the agent can learn from later.
  2. **Settings** — enable/disable agent, pick watched signals, allowed actions, per-signal recipes, quiet hours.
- Dashboard widget: "AI suggestions pending review — N".
- Notification bell surfaces new suggestions for the assigned leader.

**Message drafts** land in the existing `MessageComposerDialog` pre-filled — the leader edits and sends via existing Twilio/email paths. Agent never sends directly.

## Rollout

1. Ship custom signal schema + rule builder + evaluator (no agent yet). Users can already create/track custom signals.
2. Ship agent tables, review queue UI, and one action type (`notify`) end-to-end.
3. Add `create_task`, `add_to_flow`, `draft_message` actions one at a time.
4. Add per-signal recipes and daily sweep.

## Technical notes

- Reuse `pco_moment_mappings` condition evaluator (`supabase/functions/_shared/moment-rules.ts`) — refactor it into a generic `evaluateConditionGroup(contact, group)` so both Moments and Custom Signals share it.
- Feature-flag both areas behind new keys `custom_signals` and `signal_agent` in `organization_features` so we can pilot with one org first.
- AI cost control: batch contacts per agent invocation (up to 25), cap total per-day calls per org, log token usage to `integration_logs`.
- All agent DB writes go through `service_role` in edge functions; RLS on `signal_agent_suggestions` limits reads to org members and updates (approve/dismiss) to assigned leader or admins.

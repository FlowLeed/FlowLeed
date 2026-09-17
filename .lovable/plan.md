# FlowLeed AI Tool Catalog and Organization Controls

## Goal
Turn FlowLeed AI from a mostly read-only assistant into a trustworthy pastoral operations assistant, while letting each organization choose exactly what it may access or change.

## Confirmed current state
- The chat has only three active tools: **Look up a person**, **List people in a Flow**, and **Find people by criteria**.
- Other AI-powered features exist elsewhere—message drafting, contact suggestions, and Flow/group descriptions—but they are not available as tools inside FlowLeed AI chat.
- Chat sends the full visible conversation on each turn, so a follow-up such as “Yes” has conversational context, but there is currently no write tool to execute it.
- Organization feature controls already exist, but only system administrators can change them. The new tool controls need separate organization-owner/admin policies.

## Tool catalog
Create **Organization Settings → FlowLeed AI Tools**, visible to everyone in the organization but editable only by organization owners and admins.

Each tool shows its purpose, access level, status, confirmation rule, and recent use. Include:

### Read — answers questions without changing records
Enabled by default.
- Look up a person
- List people in a Flow
- Find people by criteria
- Summarize a person’s journey and household
- Explain Signals and matching reasons
- Review attendance, group, serving, and engagement history
- Find overdue follow-ups and people needing attention
- Summarize Flow health, stage counts, and bottlenecks
- Review groups, capacity, leaders, and participation
- Search contact notes and interaction history

### Prepare — creates a reviewable draft, but does not act
Enabled by default where the supporting feature is available.
- Draft an email
- Draft a text message
- Draft a contact note
- Build a saved people list
- Propose a follow-up plan or task list
- Draft a Form, Flow, or Signal rule
- Suggest Flow placement, assignment, and next step

### Act — changes data only after explicit confirmation
Individually controlled; sensitive actions default off.
- Add one or more people to a Flow
- Move people to another Flow step
- Assign a Flow Owner or Contributor
- Create follow-up tasks and reminders
- Add a contact note or interaction record
- Add or remove tags
- Update contact campus or status
- Refresh Signal evaluations
- Create a saved list, Form, Flow, or Signal from an approved draft
- Send an email or text message
- Manage group signup requests or group membership

Destructive actions such as deleting a person, deleting a Flow, or removing historical records will not be included in the first version.

## Organization controls
- Add a master **Allow FlowLeed AI tools** switch plus individual toggles for every tool.
- Use fixed safety levels:
  - **Read:** runs immediately when enabled.
  - **Prepare:** creates a draft for review.
  - **Act:** always requires a visible confirmation card with the exact people, destination, and change.
- Owners/admins may enable or disable tools; Leaders can see which capabilities are available but cannot change them.
- Sending messages remains separately gated by the organization’s Texting/email availability and must never be enabled merely because the AI tool toggle is on.
- Disabled tools are omitted from the model’s available tool list, not merely blocked after selection.
- The assistant explains that a capability is disabled and directs the user to an owner/admin; it never pretends the action occurred.

## Reliable action framework
Build one shared server-side action path rather than custom conversational shortcuts:
- Authenticate the user and resolve their current organization.
- Validate every person, Flow, step, group, and assignee against that organization.
- Re-check the organization tool setting and the user’s permission at execution time.
- Require an expiring, single-use confirmation for every Act tool.
- Execute with the user’s authorization context so existing row-level security remains authoritative.
- Handle duplicates idempotently, such as **Already in this Flow**.
- Read the result back before reporting success.
- Save a compact audit record: who requested it, what tool ran, affected record IDs, result, and time—never private message content or secrets.

## First action: add people to a Flow
Fix the reported Matt failure as the first Act tool:
1. FlowLeed AI resolves the verified person, Flow, and step.
2. Chat displays **Matt Dudko → Alex’s Coffee → Need to Check In** with **Confirm add** and **Cancel**.
3. Confirmation inserts the Flow membership, handles an existing membership safely, and verifies the row.
4. Only then does chat show **Added to Alex’s Coffee**, with an **Open Flow** action.
5. A typed “Yes” may confirm only the single currently pending action; ambiguous or expired confirmations ask the user to review again.

## Conversation and display safeguards
- Carry verified people and pending actions across follow-up turns so valid names are not removed from the next reply.
- Never let model-written prose claim an action succeeded; success messages come only from structured tool results.
- Render tool activity inside assistant messages with the tool name and status; keep technical inputs/results collapsed by default.
- Show previews for bulk changes with names, count, exclusions, destination, and any already-matched records before confirmation.

## Technical details
- Add organization-scoped tool settings and audit records with explicit authenticated/service grants and row-level security.
- Add a central typed tool registry containing tool key, label, description, category, default state, confirmation requirement, and required product feature.
- Build the model’s tool list from this registry plus the organization’s effective settings.
- Keep tool definitions and execution server-side; never trust person IDs, Flow IDs, or confirmation state supplied by the browser without revalidation.
- Add the settings page to the existing Settings navigation and preserve current terminology: **Flows**, **Flow Owner**, **Contributor**, and **Leader**.

## Delivery order
1. Shared tool registry, organization controls, permissions, and settings page.
2. Reliable **Add people to a Flow** tool and confirmation card; fix the Matt scenario.
3. Read tools for journey summaries, attention lists, Flow health, and group insights.
4. Prepare tools for messages, notes, tasks, saved lists, Forms, Flows, and Signals.
5. Additional Act tools, added individually with confirmation, permission, audit, and end-to-end tests.

## Verification
- Confirm owners/admins can change tool settings and Leaders cannot.
- Confirm disabled tools are absent from model requests and cannot execute through a crafted request.
- Reproduce Matt → Alex’s Coffee and verify the database membership, Flow count, person card, and chat result.
- Test confirmation button, typed “Yes,” cancel, reload, expiration, duplicate membership, wrong-organization IDs, insufficient permissions, disabled-after-preview, and retry after failure.
- Test bulk previews before any write and verify every displayed success against the resulting record.
- Verify desktop and mobile layouts, then run the complete typecheck/build and a real chat request.

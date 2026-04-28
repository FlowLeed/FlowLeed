## What's happening

The "Personal Flow" entries are real duplicate rows in the database — not a re-render glitch. Toggling "All flows" → "My flows" just re-exposes them.

Two independent bugs are at play:

### Bug 1 — Duplicate database triggers (root cause)

`organization_members` has two triggers that do the exact same thing:

- `after_owner_member_insert`
- `create_default_pipelines_trigger`

Both fire `trigger_create_default_pipelines()` on every insert, which calls `create_personal_flow_for_user()`. The function has an idempotency guard ("skip if user already leads a Personal Flow"), but because both triggers run in the same transaction, both see "none exists" and both insert a row. Result: every user joining an org gets **2** Personal Flows. The current org (`3fae9226…`) actually has 4 users → I confirmed 4 "Personal Flow" pipelines, one per user, all named the same — and one was created today at 20:45 UTC matching the user's session.

### Bug 2 — React `key` collision in sidebar

`src/components/layout/Sidebar.tsx` line 472:
```tsx
{items.map(item => <NavItem key={item.title} … />)}
```
Uses the flow's display name as the key. Multiple users' "Personal Flow" entries (visible when "Show all flows" is on) collide → the React warning in the console. Also, each user's own Personal Flow shares the name "Personal Flow" with teammates' personal flows, which is by design — so the key collision will keep happening for any same-named flow.

## Changes

### 1. Drop the duplicate trigger (migration)

```sql
DROP TRIGGER IF EXISTS create_default_pipelines_trigger
  ON public.organization_members;
```
Keep `after_owner_member_insert` as the single source of truth.

### 2. Clean up existing duplicate Personal Flows (migration)

For every (org, user) pair that has more than one "Personal Flow" they lead:

- Keep the oldest one (or the one with the most contacts/stage activity, whichever is non-empty).
- For the duplicates: re-point any `pipeline_contacts` rows to the kept flow (just in case), then delete the duplicate pipeline (cascades to stages, team members, etc.).

Safety: only target rows where `name = 'Personal Flow'` and the same user appears as `lead` on multiple of them in the same org.

### 3. Fix the React key in the sidebar

`src/components/layout/Sidebar.tsx` line 472 — change:
```tsx
items.map(item => <NavItem key={item.title} …
```
to:
```tsx
items.map(item => <NavItem key={item.flowId ?? item.path ?? item.title} …
```
Flow items always have `flowId`; non-flow nav items (Dashboard, People, etc.) always have `path`. This makes the warning impossible even if two flows ever share a name again.

## Out of scope

- No UI/UX change to how Personal Flows are displayed (still labeled "Personal Flow"). If you later want to show them as "Alex's Personal Flow" etc., that's a separate request.
- No change to `create_personal_flow_for_user`'s logic — the dedupe guard inside it is correct; removing the duplicate trigger fixes the race.

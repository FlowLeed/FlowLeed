## Scope

Two targeted upgrades to the always-loaded context in `supabase/functions/dashboard-ai-chat/index.ts`. No new tools, no DB migrations, no UI changes.

## Changes

### 1. Accurate new-contacts counts

Today the "new this week" number is derived from the last 20 contacts — wrong for any active church. Replace with two real counts:

- `new_last_7d` — `count(*) from contacts where organization_id = orgId and created_at >= now() - interval '7 days'`
- `new_last_30d` — same with 30 days

Run both as `head: true, count: 'exact'` queries in the existing `Promise.all` block. Surface in the system prompt as:

```
**People:** {totalContacts} total contacts | {new_last_7d} new in last 7 days | {new_last_30d} new in last 30 days
```

Drop the old `newContactsThisWeek` derivation.

### 2. Enriched groups summary

Today groups show only `name (type)`. Enrich with leader, member count, capacity, and meeting cadence.

Replace the current `groups` query with:

```ts
adminClient
  .from("groups")
  .select(`
    id, name, group_type, capacity, meeting_day, meeting_time, meeting_frequency,
    leader_user_id, co_leader_user_id,
    member_count:group_members(count)
  `)
  .eq("organization_id", orgId)
  .eq("status", "active")
  .is("archived_at", null)
  .order("name");
```

Resolve leader names from the already-fetched `team` array (no extra round-trip; both leader and co-leader user ids map to `team[].user_id` → `profiles.full_name`). Falls back to "Unassigned" when null or not in team.

Format each group line as:

```
- [Group Name](/groups/{id}) — {type} · led by {leaderName}{co-leader suffix if any} · {memberCount}/{capacity or "∞"} members · {meeting_day} {meeting_time} ({frequency})
```

Skip empty cadence/leader segments cleanly so groups without meeting times don't show "undefined".

Also include a header count line:

```
**Groups ({active count} active, {totalMembers} total members):**
```

Where `totalMembers` is summed from the `member_count` aggregate.

### 3. Minor prompt tightening

Update the system-prompt guidance line about groups so the model knows it can answer "which groups have open spots" and "who leads X" from the enriched summary directly, without a tool.

## Files

- `supabase/functions/dashboard-ai-chat/index.ts` — only file changed (~25 lines modified in the always-loaded context block + system prompt string).

## Out of scope (per your request)

- New tools (`search_group`, `get_pastoral_priorities`, etc.)
- Birthdays, prayer requests, at-risk people, attendance, communication history
- UI / `SuggestedPrompts` changes
- DB migrations

Want me to implement?

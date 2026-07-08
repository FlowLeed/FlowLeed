# Show a Person's Leaders on Their Profile

Goal: On a contact's profile, surface "who's in charge of this person" by pulling leaders from every active group they belong to.

## What the user sees

A new card on the contact profile, right below (or next to) the existing **Groups** card, titled **Leaders**. It lists each unique leader once, with:

- Avatar + name (links to that leader's contact profile)
- Their role badge: Leader / Co-Leader / Host
- Small subtitle listing which group(s) they lead that this person is in (e.g. "Leads: Tuesday Men's Group, Young Adults")
- Quick action icons on the right: text / email / call (same style as ContactCard)

If the person is in no groups, or their groups have no leaders assigned, the card shows a short empty state ("No group leaders assigned yet.") — or we hide it entirely. Default: hide when empty to keep the profile clean.

## Data model (already in place, no migration needed)

- `group_members` has `contact_id`, `group_id`, `role` (`leader` | `co_leader` | `host` | `member`), `status`.
- To find a contact's leaders:
  1. Get all `group_members` rows for `contact_id = X` with `status = 'active'` and non-archived groups → collect `group_id`s.
  2. Query `group_members` where `group_id IN (...)`, `status = 'active'`, `role IN ('leader','co_leader','host')`, `contact_id != X`.
  3. Fetch the `contacts` rows for those leader contact_ids (name, avatar, email, phone).
  4. Dedupe by `contact_id`, keeping the highest-priority role (leader > co_leader > host) and aggregating the list of groups they lead within this person's groups.

All reads use existing RLS on `group_members` and `contacts` — no schema or policy changes.

## Files to add / edit

- **New:** `src/components/contact/ContactLeadersCard.tsx`
  - Takes `contactId`.
  - Uses `useQuery` with key `["contact-leaders", contactId]`.
  - Runs the two-step query above, dedupes, sorts by role priority then name.
  - Renders the card described in "What the user sees".
- **Edit:** the contact profile page that currently renders `ContactGroupsCard` (locate via search for `ContactGroupsCard` — likely `src/pages/ContactsPage.tsx` or a profile subview). Insert `<ContactLeadersCard contactId={contact.id} />` right after the groups card.

No other files change. No new tables, RLS, or edge functions.

## Technical details

- Single React Query hook, no realtime — data changes infrequently.
- Query pattern mirrors `ContactGroupsCard.tsx` so the code style stays consistent.
- Role priority map: `{ leader: 0, co_leader: 1, host: 2 }`; role label + badge variant reuse the same helpers already in `ContactGroupsCard`.
- Deduping key: leader's `contact_id`. Aggregated group names come from a `Map<contactId, { leader, groups: string[], role }>`.
- Empty state: return `null` from the component when there are zero leaders, so the profile doesn't show a blank card.

## Out of scope

- Assigning/managing leaders (already handled in the Groups module).
- Showing flow owners, campus pastors, or org admins as "leaders" — this card is strictly group-derived. We can extend later if you want a broader "care team" concept.

# Consolidate Tags: one home, one source of truth

## My recommendation

Keep Tag Management, but stop treating it as a second, separate tag system.

Right now there are three places that each build their own tag list with their own query:

1. **Settings > Tag Management** — rename, merge, delete, counts per tag
2. **People > Filter > Tag** — dropdown of tags to filter by
3. **Bulk actions > Add/Remove tags** — free-text entry, no suggestions from existing tags

They don't share a source, so they can disagree — which is exactly the confusion. The fix isn't to delete Tag Management (renaming/merging/deleting a tag org-wide has no other home); it's to make all three read the same list and link to each other.

## What changes for you

- **Tag Management stays** in Settings, as the only place to rename, merge, or delete a tag org-wide. It gets accurate counts (see below) and each row becomes clickable: click a tag and you land on People, already filtered to those people.
- **People > Filter > Tag** stays as-is for filtering, but reads the same tag list as Tag Management, so the two always match. A small "Manage tags" link in the filter takes admins to Tag Management.
- **Bulk Add Tags** starts suggesting tags that already exist in your org, so imports and manual tagging stop creating near-duplicates like `easter guest` vs `Easter Guest`.
- Admin-only actions stay admin-only; non-admins just see and filter tags.

## The counting bug this also fixes

Your screenshot shows "0 unique tags" even though the org has tags in the database. The cause: Tag Management first loads every contact ID in the org, but that read is capped at 1,000 rows, and The Promise Center has ~17,900 contacts — so tags on people outside that first 1,000 are invisible. The same cap affects rename, merge and delete, meaning those actions can silently miss people. The People filter dropdown has a related cap (1,000 tag rows, alphabetical), so late-alphabet tags can vanish there.

First step of the work is to confirm this on your org, then replace the capped approach with a single database function that counts and lists tags per organization directly — no row cap.

## Technical notes

- New security-definer function `get_org_tag_stats(p_org_id uuid)` returning `tag, contact_count`, grouped over `contact_tags` joined to `contacts` for that org. Grant execute to `authenticated`.
- New shared hook `useOrgTags(organizationId)` wrapping that function, with one query key (`org-tags`). Rewire `useOrgTagManagement` (stats), `ContactFilters` (dropdown), `useOrgTagSuggestions`, and `BulkTagDialog` (suggestions) onto it, and drop the ad hoc `contacts` -> `contact_tags` two-step reads.
- Rewrite rename / delete / merge mutations to run through org-scoped SQL functions (`rename_org_tag`, `delete_org_tag`, `merge_org_tags`) instead of building a client-side `contact_id` list, so they cover every contact and stay inside the org. Merge must de-duplicate against the `contact_tags` unique constraint.
- Tag Management row click navigates to `/contacts?tag=<tag>`; `ContactsPage` reads that search param into its existing `filters.tag` state.
- `BulkTagDialog` gains a suggestions list (Command/Popover) fed by `useOrgTags`, still allowing new free-text tags.
- Mutations invalidate the single `org-tags` key plus `contacts`, so all surfaces refresh together.

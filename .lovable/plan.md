# Fix "Couldn't load sample data"

## What's wrong

Loading sample data fails at the very first step. The seeder tries to create moment types using category names the database doesn't accept, so the whole run aborts with a constraint error before any people, flows, or groups are created.

Confirmed from the edge function logs: `new row for relation "flow_moment_types" violates check constraint "flow_moment_types_category_check"` on the "First Visit" row.

## The fix

The database only allows these moment categories: `salvation`, `next_step`, `serving`, `group`, `other`. Remap the six sample moment types to valid ones:

| Sample moment | Current (invalid) | New |
| --- | --- | --- |
| First Visit | attendance | next_step |
| Salvation | milestone | salvation |
| Baptism Scheduled | milestone | next_step |
| First Gift | giving | other |
| Joined a Group | community | group |
| Missed 3 Weeks | risk | other |

Also make the seeder fail loudly and clearly: return the specific step that failed in the error message so a future mismatch is obvious from the toast instead of a generic "non-2xx status code".

## Technical notes

- Edit `MOMENT_TYPES` in `supabase/functions/demo-data-seed/index.ts` to use allowed category values.
- Wrap the moment-type insert (and other inserts) so the response includes which step failed.
- Redeploy `demo-data-seed` and verify by loading sample data, then confirm contacts, flows, groups, and moments exist for the org.

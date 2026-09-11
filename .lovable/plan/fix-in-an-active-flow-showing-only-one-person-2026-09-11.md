# Fix "In an active flow" showing only one person

## What I found

"In an active flow" is no longer the built-in signal — it was edited, which turned the built-in off and promoted it to a customized signal with two conditions:

- Is in any active Flow
- Campus is Fairfield

That combination is correct for what you asked for. The problem is the count.

In the database right now, **153 Fairfield people are enrolled in a Flow that isn't finished**, but the customized signal has matched only **1** person (Ronni Mendez). The same pattern shows on your other custom signal: "Stack in the Flow" (5+ days in a stage) matched 4 people, while 401 people in the church have sat in a stage 30+ days.

So the rule is fine; the process that checks people against custom signals is only looking at a small slice of the church — roughly the first thousand people out of 18,298 — instead of everyone. Built-in signals are calculated inside the database and are unaffected, which is why they show full counts (702, 921, etc.) while custom signals look nearly empty.

Cause: the custom-signal evaluator asks for people, check-ins, Flow enrollments, tags, moments and so on in single large requests. The data service caps each request at a fixed number of rows, so the extra rows are silently dropped. The few places that do read in pages stop after the first page for the same reason. Anyone not in that first slice is never evaluated, so they can never match a signal.

## The fix

1. Read every dataset the evaluator needs in safe pages, looping until the data actually runs out instead of assuming one big request returns everything. This covers people, check-ins, serving records, group members and meetings, group attendance, Flow enrollments, Flow Moments, online events, family members and tags.
2. Add a count check per dataset so a future silent truncation shows up in the logs rather than as a quietly wrong signal.
3. Re-run the evaluation for The Promise Center and confirm "In an active flow" reports the Fairfield people who are genuinely in a Flow (expected ~153, including the person you know about), and that "Stack in the Flow" also lands in a believable range.
4. Spot-check a handful of the newly matched people against their profiles to be sure each really has an unfinished Flow enrollment and the Fairfield campus.

## Technical details

- `supabase/functions/evaluate-custom-signals/index.ts`: replace every `.limit(50000/100000/200000)` single-shot fetch in `loadFacts` with a shared paged helper (page size 1000, loop while `rows.length === PAGE`), and fix the existing `.range()` loops whose page size exceeds the server cap so they no longer break after one page.
- Keep the paged reads scoped by `organization_id` (or by the org's pipeline/group/moment-type ids) so the extra round trips stay proportional to org size.
- No schema, RLS or rule-format changes; saved conditions and combinator semantics stay exactly as they are.
- Existing edge-function tests continue to cover `evalRule`; the change is in data loading only.
- After deploy, trigger the evaluator for the org and verify counts with direct queries.

## Note on the disabled built-in

Editing a built-in signal intentionally switches it to a customized copy, so the "In an active flow" you see now is the edited version with the Fairfield restriction. If you want the church-wide version back, remove the campus condition from that signal.

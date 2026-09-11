# Fix "Kids checked in" appearing for people with no kids

## What she saw is a real bug

Caleb's "Kids checked in" strength came from his wife Christine's own three adult Dream Team check-ins (Aug 23, Aug 30, Sep 6). The flag currently counts **any** check-in by **anyone** sharing the household — spouse, adult roommate, serving check-ins included — and labels it as kids. Caleb and Christine are recorded only as "Household Member" to each other; there are no children in that household at all.

The same mislabelling is widespread: 1,496 people in The Promise Center carry this flag today, but only about 921 have a child who actually checked in recently.

## The fix

1. Base the flag on children only
   - Use the recorded family relationships and count a check-in only when the person who checked in is a child of the contact.
   - Ignore check-ins by spouses, adult household members, and the contact themselves.

2. Ignore serving check-ins
   - A volunteer/serving check-in never means "my kid was in kids ministry", so it no longer counts toward this flag.

3. Clearer wording
   - Flag text becomes e.g. "2 kids check-in(s) in the last 30 days" instead of "household check-in(s)".
   - Update the flag's description so it reads plainly: a child in this person's family checked in recently.

4. Recalculate and confirm
   - Recalculate the Promise Center's signals right after the change.
   - Verify Caleb no longer has the flag, and spot-check a household that genuinely has kids checking in so they keep it.

## Technical details

- Change the `household_person_ids`/`household_stats` portion of `recompute_contact_markers` (latest definition in `supabase/migrations/20260911212649_*.sql`) to source people from `contact_family_members` where `lower(relationship) = 'child'` and `pc_person_id` is not null, instead of matching every contact sharing `pc_household_id`.
- Add `coalesce(checkin_kind,'regular') <> 'volunteer'` to the kids check-in filter.
- Update the `marker_definitions` label/description for `kids_checked_in`; keep the existing `days` parameter (default 30) so the editable signal logic and the custom-signal evaluator stay in sync.
- Mirror the same child-only + non-volunteer rule in the matching condition inside `supabase/functions/evaluate-custom-signals/index.ts` so rewritten versions of this signal behave identically.
- Expected result for The Promise Center: roughly 1,496 flagged people drops to about 921 genuine ones.

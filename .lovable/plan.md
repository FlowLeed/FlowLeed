## Problem

Searching for `+1 (408) 427-7192` returns no results, even though the contact exists with phone `+14084277192`.

### Root cause

The current code in `AddPeopleToFlowDialog.tsx` extracts all digits from the search input (`14084277192`) and builds an ILIKE pattern that requires every digit to appear in order: `%1%4%0%8%4%2%7%7%1%9%2%`.

That works against `+14084277192`, but fails for the **24,288 contacts (94%)** whose phones are stored *without* the `+1` country code (e.g. `4084277192`, `(408) 427-7192`, `408-427-7192`). For those rows there is no `1` before the `4`, so the pattern never matches.

DB snapshot:
- 1,586 contacts stored as `+1...`
- 24,288 contacts stored without any `+`
- 20 contacts with a non-US country code

So the very common case of "user types/pastes a US number with +1, but the contact in the DB has no country code" silently returns nothing.

## Fix

Update the phone search in `src/components/crm/add-people/AddPeopleToFlowDialog.tsx` so it tries both:
1. The full digit string as typed (e.g. `14084277192`)
2. The US 10-digit local form when the input starts with `1` and has 11 digits (e.g. `4084277192`)

Combine the two with PostgREST's `.or()` filter so a row matches if either ILIKE pattern hits:

```
phone.ilike.%1%4%0%8%4%2%7%7%1%9%2%,phone.ilike.%4%0%8%4%2%7%7%1%9%2%
```

Logic outline:
- Detect phone-like input (digits + typical phone punctuation, ≥3 digits) — unchanged.
- Build `digits` from input.
- Build `candidates`:
  - Always include `digits`.
  - If `digits.length === 11 && digits.startsWith('1')`, also include `digits.slice(1)` (strip US country code).
  - If `digits.length === 10`, also include `'1' + digits` (handle the reverse: typed local, stored with +1).
- Map each candidate to `phone.ilike.%d1%d2%...%` and join with `,` for `q.or(...)`.

This keeps the wildcard-between-digits approach (so any formatting in the stored value still matches) but no longer requires the country code to be present on both sides.

## Apply same fix elsewhere

Two other places use the same digit-interleave pattern and have the same bug. Update them for consistency:

- `src/hooks/useContacts.tsx` (lines ~150-152) — main contacts list search.
- `src/components/search/GlobalSearch.tsx` (line ~118) — global search bar.

`src/components/groups/AddGroupMemberDialog.tsx` does a plain `phone.ilike.%term%` and won't match formatted input at all — extend it with the same phone-aware logic so group member search behaves consistently.

Extract the candidate-building + OR-filter construction into a small helper (e.g. `src/lib/phoneSearch.ts` exporting `buildPhoneOrFilter(input)` and `isPhoneLike(input)`) so all four call sites share one implementation.

## Out of scope

- Non-US country codes (20 contacts). The +1 ↔ local handling covers the realistic case for this user; we won't try to be clever about arbitrary country codes here.
- Normalizing stored phone numbers in the DB. That's a bigger migration; the search-side fix is enough to unblock the user.

## Files touched

- `src/lib/phoneSearch.ts` (new)
- `src/components/crm/add-people/AddPeopleToFlowDialog.tsx`
- `src/hooks/useContacts.tsx`
- `src/components/search/GlobalSearch.tsx`
- `src/components/groups/AddGroupMemberDialog.tsx`

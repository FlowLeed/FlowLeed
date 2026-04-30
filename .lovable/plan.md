## Problem

Phone search works in the "Add People to Flow" dialog but fails in the **Global Search** (Cmd+K) and **Add Group Member** dialog. The server returns the right contacts, but they get hidden before display.

## Root cause

Both broken searches use the cmdk `Command` component, which by default **filters results client-side** by matching the typed text against each item's `value` prop. The `value` is built from name + email + phone — and the stored phone (`+14084277192`) doesn't match the user's formatted input (`+1 (408) 427-7192`), so cmdk drops every row even though the server returned them correctly.

The working "Add People to Flow" dialog uses a plain `<Input>` (no cmdk filtering), which is why it displays results.

## Fix

Disable cmdk's client-side filtering in the two affected components and rely entirely on the server-side query (which already uses `buildPhoneOrFilter` correctly).

### Files to change

1. **`src/components/search/GlobalSearch.tsx`**
   - Pass `shouldFilter={false}` to the `CommandDialog` (cmdk Command root).
   - Remove the synthetic `value={...name email phone}` from each `CommandItem` so cmdk doesn't try to score them.

2. **`src/components/groups/AddGroupMemberDialog.tsx`**
   - Pass `shouldFilter={false}` to the `Command` wrapper.

3. **`src/components/ui/command.tsx`** (if needed)
   - Verify `CommandDialog` forwards extra props (like `shouldFilter`) through to the underlying `Command`. If it doesn't, thread the prop through.

### Bonus consistency pass

While in there, audit any other `Command`-based contact pickers for the same client-filter issue (none currently found beyond the two above, but a quick grep for `CommandInput` + `contacts` will confirm).

## Why this works

- The server query already returns the correct rows for `+1 (408) 427-7192`, `4084277192`, etc. via `buildPhoneOrFilter`.
- Disabling `shouldFilter` lets every server result render as-is, exactly like the working Add-People dialog.
- No changes needed to `phoneSearch.ts` or `useContacts` — those are already correct.

## Out of scope

- The `useContacts` hook (Contacts page) doesn't use cmdk filtering, so it isn't affected by this bug.
- No DB migrations or edge-function changes.
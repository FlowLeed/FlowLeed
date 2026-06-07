
## Problem

In `AIChatInput.tsx`, `detectMention` walks back from the caret to find `@`, but **breaks on any whitespace** (`if (/\s/.test(ch)) break;`) and the fragment regex `^[\w\-\.]*$` rejects spaces. So as soon as the user types `@Alexa ` (space) to type the last name, the mention is no longer detected and the dropdown closes — confusing, since the user thinks they're still mid-mention.

## Goal

Let the user type `@Alexa Yarmolatii` and keep the dropdown open & filtering against the full multi-word query, while still closing cleanly when they clearly move on.

## Approach (recommended)

**Allow up to 2 spaces inside the active mention query, and stop when:**
1. The user types a 3rd space, OR
2. The user types a newline / punctuation that clearly ends a name (`,` `.` `!` `?` `;` `:`), OR
3. The fragment grows longer than ~40 chars, OR
4. The user moves the caret before the `@`.

This matches Slack / Jira / Linear behavior: they keep the picker open through a space or two so "First Last" works, then close on a clear delimiter.

### Changes to `src/components/dashboard/AIChatInput.tsx`

1. **`detectMention`** — rewrite the lookback loop:
   - Walk back from caret to find the nearest `@` preceded by start-of-string or whitespace.
   - Build `fragment = value.slice(atIndex + 1, caret)`.
   - Accept the fragment if it matches `/^[\w\-\.][\w\-\.\s]{0,40}$/` AND contains at most 2 spaces AND no name-ending punctuation. Otherwise treat as no active mention.
   - This lets `@`, `@a`, `@alexa`, `@alexa `, `@alexa y`, `@alexa yarmolatii` all keep the dropdown open.

2. **Visual cue while query has a space** — add a subtle hint row at the top of the dropdown (e.g. "Keep typing last name, or press Esc"). Reuses existing popover styling, no new tokens. This removes the "is this still active?" confusion.

3. **Search call** — already uses the raw fragment as `_search_term`; `search_visible_contacts` does ILIKE on full name, so `"alexa yar"` will correctly match "Alexa Yarmolatii". No backend change needed.

4. **`insertMention`** — already replaces from `triggerStartRef` to the current caret with `@${contact.name} `, so multi-word fragments get cleanly replaced by the canonical full name + trailing space. No change needed beyond confirming behavior with the new detection range.

5. **`handleKeyDown`** — no change. Space stays as a normal character (not a commit key). Enter / Tab still commit the highlighted contact; Escape still cancels. This is important: using Space-to-commit would conflict with typing the last name.

### Out of scope

- No switch to a contenteditable / Tiptap chip editor (still a v2 idea).
- No change to `useDashboardChat` or the RPC.
- No change to how mentions are serialized into the outbound payload.

### Edge cases handled

- `"hello @alexa yarmolatii how are you"` — dropdown closes after the 3rd word because we cap at 2 spaces, so "how" doesn't get pulled into the query.
- `"email me at user@example.com"` — `@` is preceded by `r` (not whitespace), so no mention is triggered. Existing guard already covers this.
- Caret moves back before `@` — existing logic already invalidates.
- User picks a contact mid-typing — `insertMention` replaces the full `@alexa yar` span with `@Alexa Yarmolatii `.

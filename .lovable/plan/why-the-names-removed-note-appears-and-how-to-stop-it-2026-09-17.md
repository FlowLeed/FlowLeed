# Why the "names removed" note appears, and how to stop it

## What that note means

After the assistant invented a person ("Zoe Thompson"), a safety check was added: any person the assistant links to must have come from a real records lookup in that same reply. Anything else is removed, and the note tells you how many were removed.

## Why it fires on real people

The list of verified people is rebuilt from scratch on every turn, and it is only filled from lookups performed in that turn. So when the assistant answers a follow-up without running a new lookup — for example after you say "Yes", or when it refers back to people it already found earlier in the same conversation — those people count as unverified. Their names get stripped and you see the note, even though the people exist.

## Plan

1. Remember verified people for the whole conversation, not just one turn: collect them from earlier assistant replies in the conversation history as well as from lookups in the current turn, so a real person mentioned a moment ago stays valid.
2. When a person's link cannot be verified, keep their name as plain text instead of deleting the sentence, so answers no longer lose lines.
3. Stop showing the note to you. Keep the protection (unverified links become plain text, invented list entries are dropped) but remove the technical footnote from the reply.
4. Leave the invented-person guard itself in place: an unknown person still never becomes a clickable link, and a fabricated list entry is still dropped.

## Technical details

- In `supabase/functions/dashboard-ai-chat/index.ts`, `allowedPeople` is populated only by `registerPeople()` on tool results within the current request. Seed it additionally by scanning prior assistant messages in `messages` for `[Name](/contacts/<uuid>)` links, and validate those UUIDs against `contacts` scoped to the caller's organization before trusting them (so history can't be forged from the client).
- Change `sanitizePeopleMentions` so an unverified link degrades to its plain-text name rather than an empty string, keeping the existing drop rule only for list lines whose every link is unverified.
- Remove the `_Note: N names…_` append at the end of the stream; keep `removed` for server-side logging only.
- Redeploy `dashboard-ai-chat` after the change.

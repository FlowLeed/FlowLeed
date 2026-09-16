# Fix the invented person ("Zoe Thompson") and the disappearing conversation

## What's happening

Two separate problems, both confirmed:

1. **Zoe Thompson does not exist.** There is no Zoe Thompson in your church's records (there are 18 other Thompsons, no Zoe). The assistant made the name up and added it to the end of the list with "(Added based on Youth Group criteria)". That's why the count in the text (24) and the button (25) disagree, and why asking "Who is Zoe Thompson?" returns nothing. The assistant is currently free to write extra names in its answer; nothing checks that every name it prints actually came from the search it ran.

2. **Clicking her name throws you back to the start.** A person's name is a link to that person's page. For an invented person the page can't load, and the page's error path silently sends you back to the previous screen — the dashboard. The dashboard chat only lives in the screen you're on, so coming back shows an empty question box and your conversation looks lost.

## What we'll change

### 1. The assistant may only name people it actually found
- Every answer's names are checked against the people the search returned. Any name the assistant invented is stripped out before you see it, and the answer is corrected to the real count.
- Person links are rebuilt from the real records, so a name can never point at a person who doesn't exist.
- The prompt is tightened: never add, guess, complete or "helpfully" extend a list; if a part of the request can't be filtered (for example "don't count the youth group as active"), say so plainly instead of hand-adding people.

### 2. Honour "don't count group X as active"
Christine's request excluded the PC Youth | Middle & High School Students group. The assistant answered around it in prose and then bolted a person on. We'll let the search take a list of groups to ignore when deciding "in an active group right now", so that request is answered properly instead of narrated.

### 3. Clicking a name never wipes your conversation
- If a person's page can't be found, it shows "We couldn't find this person" with a Back button instead of silently bouncing you.
- The dashboard conversation is remembered, so leaving to a person's profile and coming back shows the same conversation where you left it, not a blank box.
- Names that don't resolve to a real person aren't rendered as links at all.

### 4. Button count always matches the list
The "Review N people" button uses exactly the people named in the answer — no more 24 in the text and 25 on the button.

## Technical notes

- `supabase/functions/dashboard-ai-chat/index.ts`
  - `find_contacts_by_criteria`: new optional `exclude_group_names: string[]` (resolved to group ids, org-scoped) applied to the `not_in_active_group` / active-membership check; unresolved names reported through the existing `CRITERIA NOT APPLIED` note.
  - Keep a per-request allow-list of `{id, name}` returned by contact tools. In the streaming wrapper, buffer the assistant text and post-process before emitting: drop `[Name](/contacts/<id>)` links whose id isn't in the allow-list, drop plain-text list lines naming someone not in the allow-list, and recompute any "I found N" count from the surviving set.
  - System prompt: explicit no-fabrication rule — names and ids may only be copied verbatim from tool output; never append people from reasoning; unsupported filters must be declared, not compensated for.
- `src/pages/UserProfilePage.tsx`: replace `if (error) { navigate(-1); return null; }` with a "Person not found" state (message + Back button); keep the console error.
- `src/hooks/useDashboardChat.tsx`: persist `conversationId` (sessionStorage) and rehydrate messages on mount via the existing `loadConversation`, so route changes don't reset the thread.
- `src/components/dashboard/ChatThread.tsx`: only turn `/contacts/:id` links into navigation when the id is a UUID present in the message's contact-id marker; otherwise render as plain text.

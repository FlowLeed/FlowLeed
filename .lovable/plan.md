

## Improve Chat Readability and Add Clickable Links

Three changes to `ChatThread.tsx` and the edge function system prompt.

### 1. Remove border from assistant bubbles, improve spacing

In `ChatThread.tsx`:
- Remove `border` class from assistant message bubble (line 44)
- Remove `border` from loading indicator bubble (line 72)
- Change `space-y-1` to `space-y-4` on the container for more breathing room between messages
- Add more prose spacing: `prose-p:my-3 prose-li:my-1 prose-headings:mt-6 prose-headings:mb-3` to the markdown wrapper for better paragraph separation
- Increase text size from `text-sm` to `text-base` for better readability

### 2. Make flows and people clickable

Add a custom `ReactMarkdown` renderer that detects and linkifies flow names and contact names. Two approaches combined:

**A. Update the edge function system prompt** (`supabase/functions/dashboard-ai-chat/index.ts`):
- Add a guideline instructing the AI to format flow names as markdown links: `[Flow Name](/flows/{id})` and people names as `[Person Name](/contacts/{id})`
- Include a lookup table in the system prompt mapping flow names to IDs (from pipelines data already fetched) and contact names to IDs (from contacts data already fetched)
- Example guideline: "When mentioning a Flow, always link it: [FF New Family Follow-Up](/flows/abc-123). When mentioning a person, always link them: [John Smith](/contacts/def-456)."

**B. Add link renderer in `ChatThread.tsx`**:
- Add a custom `a` component to `ReactMarkdown` that uses `react-router-dom`'s `useNavigate` for internal links (`/flows/...`, `/contacts/...`) so navigation stays in-app
- Style links with primary color and underline

### 3. Files changed

- **`src/components/dashboard/ChatThread.tsx`**: Remove borders, increase spacing, add link renderer with in-app navigation
- **`supabase/functions/dashboard-ai-chat/index.ts`**: Add flow ID/contact ID lookup tables to system prompt; add guideline to always use markdown links for flows and people


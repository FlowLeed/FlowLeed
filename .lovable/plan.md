

## Fix Paragraph Spacing in AI Responses

The spacing CSS is already generous (`prose-p:mb-6`). The real issue is the AI model is not inserting blank lines between items like "Team Care: ..." — markdown treats consecutive lines as one paragraph.

### Changes

**`supabase/functions/dashboard-ai-chat/index.ts`**
- Add explicit instruction to the system prompt: "When listing flows or categories with descriptions, put each on its own paragraph with a blank line above it. Never stack multiple items in a single paragraph."
- Reinforce: "After any colon-separated item (e.g. 'Team Care: ...'), always add a blank line before the next item."

**`src/components/dashboard/ChatThread.tsx`**
- Add a CSS rule to increase spacing on `<strong>` or `<a>` tags that start a line (acting as pseudo-headers within paragraphs), using `[&_p+p]:mt-4` or similar to ensure even same-paragraph content gets visual separation.
- Increase `prose-p:leading-7` to `prose-p:leading-8` for more breathing room within paragraphs.

### Summary
Two-pronged fix: tell the AI to format with proper blank lines, and add CSS fallback spacing for tighter content.


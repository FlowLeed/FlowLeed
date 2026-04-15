

## Improve AI Chat Paragraph Spacing Consistency

The issue: items like "Dream Team: description" and "Pastoral Note: description" run together without line breaks, while other paragraphs have proper spacing. This is a two-sided problem — the AI sometimes omits blank lines between items, and the CSS doesn't compensate enough.

### Changes

**1. `supabase/functions/dashboard-ai-chat/index.ts`** — Strengthen system prompt formatting rules
- Replace the existing formatting guidelines with stricter, example-driven instructions:
  - "When describing multiple flows, moments, or categories, use a **bold label** on its own line followed by the description on the next line, with a blank line before each label."
  - Add a concrete example in the prompt showing the expected format (bold label → blank line → description → blank line → next label).
  - Emphasize: "NEVER put two bold-labeled items in the same paragraph. Each must be its own paragraph."
- Redeploy the edge function.

**2. `src/components/dashboard/ChatThread.tsx`** — CSS fallback for tighter content
- Add a custom markdown component for `strong` that adds top margin when it appears at the start of a paragraph, creating visual separation even if the AI skips a blank line.
- Add CSS rules to the prose container:
  - `[&_p_strong:first-child]:inline-block [&_p_strong:first-child]:mt-2` — gives bold labels at paragraph starts extra breathing room.
  - Increase `[&_p+p]:mt-4` to `[&_p+p]:mt-6` for more visible paragraph separation.

### Summary
Stricter AI prompt with concrete formatting examples + CSS rules that enforce visual spacing even when markdown is imperfect.


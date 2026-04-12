

## AI-Powered Dashboard Redesign

Replace the current metrics/cards dashboard with a conversational AI interface inspired by Perplexity/Claude, tailored for pastors.

### Design

```text
┌─────────────────────────────────────────────┐
│  Header: "Welcome back, CJ!"               │
├─────────────────────────────────────────────┤
│                                             │
│         ✨ How can I help you today?        │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Ask about your people, tasks...    │    │
│  │                                     │    │
│  │                          [Submit ▶] │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [👥 People] [📊 Numbers] [👤 Team] [🙏 Care]│
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ 👥 People                       ✕  │    │
│  │─────────────────────────────────────│    │
│  │ Show me people at risk              │    │
│  │ Who needs follow-up this week?      │    │
│  │ Show first-time guests              │    │
│  │ Who attended but isn't in a group?  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ── Conversation thread appears below ──    │
│  [AI responses with markdown, cards, etc.]  │
│                                             │
└─────────────────────────────────────────────┘
```

### Architecture

1. **New Edge Function** (`supabase/functions/dashboard-ai-chat/index.ts`): Receives the user's question + userId/orgId, queries relevant Supabase tables (contacts, interactions, pipelines, groups, prayer requests), builds a context-rich prompt, calls Lovable AI Gateway with streaming, returns SSE stream. Uses tool-calling to return structured data (contact lists, metrics) alongside natural language.

2. **New Dashboard Page** (`src/pages/Dashboard.tsx`): Complete rewrite. Shows greeting, large input box, category chips, and suggested prompts. On submit, streams AI response into a chat thread below. Preserves onboarding wizard logic for new users.

3. **New Components**:
   - `src/components/dashboard/AIChatInput.tsx` -- Large input with submit button
   - `src/components/dashboard/CategoryChips.tsx` -- People, Numbers, Team, Care chips that reveal contextual prompts
   - `src/components/dashboard/SuggestedPrompts.tsx` -- Clickable prompt cards under each category
   - `src/components/dashboard/ChatThread.tsx` -- Renders conversation with markdown support (react-markdown)
   - `src/components/dashboard/AIResponseCard.tsx` -- Structured data cards (contact lists, metrics) rendered inline

4. **Suggested Prompts by Category**:
   - **People**: "Show people at risk of slipping away", "Who needs follow-up this week?", "Show first-time guests from this weekend", "Who hasn't received a second contact?"
   - **Numbers**: "Summarize church health this month", "Show attendance trends", "How many new contacts this week?"
   - **Team**: "Show leaders who need support", "Who on my team has the most contacts?", "What follow-ups are overdue for my team?"
   - **Care**: "Show urgent prayer requests", "Who is in hospital or crisis?", "What care follow-ups are overdue?"

5. **Edge Function Data Access**: The AI function will query the database server-side using service role, gathering contacts, pipeline_contacts, interactions, groups, prayer requests, etc. based on the user's org. It builds a system prompt with this data context, then lets the LLM answer naturally.

### Files to create/edit

| File | Action |
|------|--------|
| `supabase/functions/dashboard-ai-chat/index.ts` | Create -- AI chat edge function with streaming |
| `src/pages/Dashboard.tsx` | Rewrite -- AI-first layout, keep onboarding logic |
| `src/components/dashboard/AIChatInput.tsx` | Create -- Large input box component |
| `src/components/dashboard/CategoryChips.tsx` | Create -- Category chip selector |
| `src/components/dashboard/SuggestedPrompts.tsx` | Create -- Prompt suggestions per category |
| `src/components/dashboard/ChatThread.tsx` | Create -- Message thread with markdown rendering |
| `src/hooks/useDashboardChat.tsx` | Create -- Hook for streaming chat state management |
| `package.json` | Add `react-markdown` dependency |

### Technical details

- Streaming uses SSE via Lovable AI Gateway (`google/gemini-3-flash-preview`)
- System prompt includes: user's name/role, org name, summary metrics (contact counts, overdue follow-ups, recent activity), so the AI can answer data questions accurately
- The edge function performs targeted DB queries based on detected intent (people queries vs. metrics vs. care) to keep context focused
- Conversation history is maintained in React state (not persisted) -- each dashboard visit starts fresh
- Onboarding wizards and celebration modals are preserved unchanged
- Old dashboard components (`PersonalMetrics`, `ContactsNeedingAttention`, etc.) remain in codebase but are no longer imported by Dashboard




## Add Follow-up Input After AI Response

Currently the chat input only appears once at the top. Once a conversation starts, users have no way to ask follow-up questions. The fix is to show a second input pinned at the bottom of the chat area when messages exist.

### Changes

**`src/pages/Dashboard.tsx`**
- Move the `AIChatInput` for active conversations out of the scrollable area and into a sticky bottom position
- When `hasMessages` is true, render the input after the `ChatThread` at the bottom of the viewport (outside the scroll container), so it's always visible
- Keep the original centered input for the empty/hero state only

Layout becomes:
```text
┌──────────────────────────────┐
│ Header                       │
├──────────────────────────────┤
│ [scrollable area]            │
│   Chat messages...           │
│                              │
├──────────────────────────────┤
│ [sticky bottom input]        │  ← only when hasMessages
│  "Ask a follow-up..."       │
└──────────────────────────────┘
```

**`src/components/dashboard/AIChatInput.tsx`**
- No structural changes needed -- the component already accepts `hasMessages` prop and adjusts width accordingly

**`src/hooks/useDashboardChat.tsx`**
- Already sends full `messages` array to the edge function, so conversation context is preserved automatically

### Summary
- 1 file edit (`Dashboard.tsx`): show input in hero area when no messages, move it to a sticky bottom bar when conversation is active
- Context continuity already works -- the hook sends full history to the AI


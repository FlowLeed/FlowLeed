

## Chat History with Auto-Titling (Option D — Side Panel)

### How it works

A small **clock/history icon** appears next to the "New conversation" button in ChatThread (and also in the hero state). Clicking it opens a **right-side drawer** listing past conversations with AI-generated titles. Conversations are stored in a Supabase table and auto-titled after the first assistant response.

```text
+--sidebar--+--------main-content--------+--drawer (when open)--+
|            |  How can I help you?       |  Chat History        |
|  FLOWS     |  [input]                   |  "Attendance Q1" 2h  |
|  ...       |  [chips]                   |  "New members" 1d    |
|            |                            |  "Prayer req..." 3d  |
+------------+----------------------------+----------------------+
```

### Database

**New table: `chat_conversations`**
- `id` (uuid, PK)
- `user_id` (uuid, references auth.users, NOT NULL)
- `organization_id` (uuid, references organizations, NOT NULL)
- `title` (text, nullable — null until auto-titled)
- `messages` (jsonb, NOT NULL, default '[]')
- `created_at`, `updated_at` (timestamptz)
- RLS: users can only read/write their own conversations
- Index on `(user_id, updated_at DESC)` for fast listing

### Auto-titling

After the first assistant response completes, call the existing `dashboard-ai-chat` edge function (or a lightweight new one) with a prompt like: *"Summarize this conversation in 3-5 words as a title"*. Update the `title` column. This happens in the background — doesn't block the user.

### Frontend changes

1. **`src/hooks/useDashboardChat.tsx`** — Add:
   - `conversationId` state (current active conversation)
   - Auto-save messages to Supabase after each assistant response
   - `loadConversation(id)` to restore a past conversation
   - `deleteConversation(id)` to remove from DB
   - Auto-title logic after first exchange

2. **`src/hooks/useChatHistory.tsx`** (new) — Simple hook:
   - Fetches list of conversations (`id, title, updated_at`) ordered by recency
   - Provides `conversations`, `isLoading`, `deleteConversation`
   - Limit to 50 most recent

3. **`src/components/dashboard/ChatHistoryDrawer.tsx`** (new):
   - Uses Sheet component (right side)
   - Lists conversations with title (or truncated first message if untitled), relative timestamp
   - Click to load, swipe/trash icon to delete
   - Empty state: "No previous conversations"

4. **`src/components/dashboard/ChatThread.tsx`** — Add a History icon button next to "New conversation"

5. **`src/pages/Dashboard.tsx`** — Add History icon in the hero state too (top-right corner), wire up drawer state and `loadConversation`

6. **`supabase/functions/generate-chat-title/index.ts`** (new edge function) — Lightweight call to Lovable AI Gateway asking for a 3-5 word title given the first exchange. Called once per conversation.

### Summary
One new DB table, one new edge function for titling, one new drawer component, and updates to the chat hook to persist/restore conversations.


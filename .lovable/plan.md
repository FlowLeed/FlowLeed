

## Optimize Flows Sidebar for Scale

When an org has 100+ flows, the sidebar becomes unusable. We'll add two features: **pinned/favorite flows** and a **"My Flows" default filter** with a toggle to show all.

### How it will work

1. **My Flows vs All Flows toggle** — The sidebar defaults to showing only flows where the current user is a team member (via `pipeline_team_members`). A small toggle or link ("Show all") reveals the full list.

2. **Pinned flows** — Users can pin flows to always appear at the top of the sidebar, regardless of the filter. A star/pin icon on hover lets them toggle. Pinned flows appear in a separate "Pinned" subsection above the rest.

3. **Visual layout** — The Flows section will show:
   - Pinned flows (always visible, small "PINNED" label)
   - Remaining flows (filtered to "my flows" by default)
   - A "Show all flows" / "Show my flows" toggle at the bottom

### Technical changes

**Database migration** — New `user_flow_preferences` table:
```sql
CREATE TABLE public.user_flow_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, pipeline_id)
);
ALTER TABLE public.user_flow_preferences ENABLE ROW LEVEL SECURITY;
-- Users can manage their own preferences
CREATE POLICY "Users can manage own flow preferences"
  ON public.user_flow_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**New hook: `src/hooks/useFlowPreferences.tsx`**
- Fetches the user's pinned flow IDs from `user_flow_preferences`
- Provides `togglePin(pipelineId)` mutation
- Provides `pinnedFlowIds: Set<string>`

**Modified: `src/components/layout/Sidebar.tsx`**
- Import `useFlowPreferences` and `useMyFlows` (already exists)
- Add state: `showAllFlows` (default `false`)
- Split `flowItems` into `pinnedItems` and `filteredItems`:
  - `pinnedItems` = flows where `pinnedFlowIds.has(flow.id)`
  - When `showAllFlows` is false, `filteredItems` = flows where user is a team member (use `useMyFlows` data to get the IDs)
  - When `showAllFlows` is true, `filteredItems` = all flows minus pinned
- Render pinned flows first with a subtle "PINNED" label
- Add a pin icon on hover for each flow item (star or pin icon)
- Add a small toggle link at the bottom: "Show all" / "My flows only"

**Modified: `src/components/layout/Sidebar.tsx` — NavItem**
- Add an optional `onPin` callback and `isPinned` prop
- Show a small star icon on hover (filled if pinned) that calls `onPin`

### Summary
One new DB table for pin preferences, one new hook, and sidebar modifications to filter and pin flows. No changes to FlowContext or existing data loading.


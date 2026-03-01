

## Reframe Tasks Page: Flows ARE the Tasks

The current Tasks page has two disconnected concepts: "People Needing Attention" (from flows) and "Scheduled Follow-Ups" (from `contact_interactions`). The user's mental model is simpler: **every person assigned to you in a flow stage IS your task**. Creating a new task means assigning someone to a flow stage.

### Changes

**1. Rethink "New Task" dialog (`CreateTaskDialog.tsx`)**
- Replace the current `contact_interactions`-based form with a flow-assignment dialog
- Steps: Search contact → Select flow → Select stage → Assign (inserts into `pipeline_contacts` with `assigned_to_user_id = current user`)
- Reuse the existing `FlowSelectionStep` and `StageSelectionStep` components from `AddToFlowDialog`
- Title: "Add to Flow" instead of "New Follow-Up Task"

**2. Simplify the Tasks page (`TasksPage.tsx`)**
- **Section 1 stays**: "People I Need to Follow Up With" -- contacts assigned to you in flows, sorted by days since last contact. This is the core task list.
- **Section 2 becomes optional/secondary**: Keep "Scheduled Follow-Ups" as a smaller section for explicit reminders, but the primary view is the flow-based list.
- "New Task" button label changes to "Assign to Flow" or "Add to Flow"

**3. Update `useTasksPageData.tsx`** (minor)
- Already correct -- it queries `pipeline_contacts` assigned to the user. No changes needed to the data hook.

**4. Keep `TaskContactRow.tsx` and `ScheduledTaskItem.tsx`** as-is -- they already work correctly.

### Technical Detail

The new CreateTaskDialog will:
1. Search contacts (existing logic)
2. Fetch pipelines via `supabase.from('pipelines').select('id, name, icon')`
3. Fetch stages via `supabase.from('pipeline_stages').select('id, name, color, stage_order, default_assignee_user_id')`
4. Insert into `pipeline_contacts` with `assigned_to_user_id = currentUser.id`
5. Invalidate `tasks-page-contacts` query key

### Files Modified
- `src/components/tasks/CreateTaskDialog.tsx` -- rewrite to flow-assignment dialog
- `src/pages/TasksPage.tsx` -- update button label, minor copy changes


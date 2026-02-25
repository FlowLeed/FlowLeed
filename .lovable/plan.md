

## Tasks Page: "People I Need to Connect With" + Flow-Aware Task Creation

### Concept

Replace the Tasks placeholder with a page that answers: **"Who do I need to reach out to, and what's the next step to move them forward in their flow?"**

The page combines the "Contacts Needing Attention" logic (contacts assigned to you with no recent interaction) with flow context (which flow and stage they're in), and lets you create follow-up tasks directly from the list.

### Data Available

The existing `useMyContactsNeedingAttention` hook already queries `pipeline_contacts` for contacts assigned to the current user, checks `contact_interactions` for recency, and returns `daysSinceLastContact` plus the flow name. We'll extend this approach to also return **stage info** and the **next stage name**, so the user can see where each person is and where they need to go.

No database changes are needed -- everything uses existing tables: `pipeline_contacts`, `pipeline_stages`, `contacts`, `contact_interactions`.

### What the Tasks Page Will Show

**Section 1 -- People I Need to Connect With**
- Full list (not dashboard's 5-item limit) of contacts assigned to you that haven't been contacted recently
- Each row shows: avatar, name, current flow + stage, days since last contact, and a colored urgency badge
- Sorted by most overdue first
- Clicking a contact navigates to their profile

**Section 2 -- My Upcoming Tasks**
- Full list of scheduled `contact_interactions` assigned to you (existing data from `useMyUpcomingTasks`)
- Shows subject, contact name, due date, and interaction type badge
- Checkbox to mark complete (sets `completed_at`)

**Section 3 -- Quick Action: Create Follow-Up Task**
- "New Task" button in the header
- Dialog with: contact search, subject, interaction type (call/email/visit/text/meeting), due date, optional notes
- Inserts a `contact_interactions` row with `scheduled_at`

### Files to Create / Modify

1. **`src/hooks/useTasksPageData.tsx`** (new)
   - Extended version of `useMyContactsNeedingAttention` that also fetches `stage_id`, stage name, and next stage name from `pipeline_contacts` joined with `pipeline_stages`
   - Returns contacts grouped by urgency (overdue 30d+, 14d+, 5d+)
   - No row limit (shows all)

2. **`src/components/tasks/TaskContactRow.tsx`** (new)
   - Row component: avatar, name, flow badge, stage badge, "X days ago" urgency badge
   - "Log Interaction" quick action button that creates a `contact_interaction` and marks the contact as reached

3. **`src/components/tasks/CreateTaskDialog.tsx`** (new)
   - Contact selector (searches org contacts)
   - Subject, interaction type dropdown, date picker, notes
   - Inserts into `contact_interactions`

4. **`src/components/tasks/ScheduledTaskItem.tsx`** (new)
   - Checkbox + subject + contact link + relative date
   - Checkbox toggles `completed_at`

5. **`src/pages/TasksPage.tsx`** (update)
   - Header with "Tasks" title and "+ New Task" button
   - Two sections: "People to Connect With" and "Scheduled Follow-Ups"
   - Filter tabs on scheduled tasks: Upcoming / Overdue / Completed
   - Empty states for each section

6. **`src/components/dashboard/UpcomingTasks.tsx`** (update)
   - Change "View All" link from `/contacts` to `/tasks`

7. **`src/components/dashboard/ContactsNeedingAttention.tsx`** (update)
   - Change "View All" link from `/contacts` to `/tasks`

### Technical Detail: Fetching Flow Stage Context

```text
pipeline_contacts (assigned_to_user_id = me)
  → join pipeline_stages (stage_id) → get current stage name + stage_order
  → join pipeline_stages (same pipeline, stage_order + 1) → get next stage name
  → join pipelines → get flow name + icon
  → join contacts → get name, avatar, email
```

This gives each "needing attention" contact full context: "John is in **Baptism Flow → Stage: Interested** → Next step: **Scheduled**"

### No Database Changes

All data lives in existing tables with existing RLS policies. The `contact_interactions` table already supports `scheduled_at`, `completed_at`, `assigned_to_user_id`, `interaction_type`, and `subject`.


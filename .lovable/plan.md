

## Move Old Dashboard Widgets to Tasks Page

The Dashboard was redesigned to be AI-chat-focused, removing the **Personal Metrics cards**, **Contacts Needing Attention**, **Upcoming Tasks**, and **Team Activity Feed**. These should now live on the Tasks page.

### Changes

**`src/pages/TasksPage.tsx`**
- Import and add `PersonalMetrics` at the top (My Contacts, My Interactions, Pending Tasks, Need Attention)
- Import and add `UpcomingTasks` section (scheduled follow-ups with checkboxes) using `useAllScheduledTasks` from `useTasksPageData.tsx`
- Import and add `TeamActivityFeed` at the bottom
- Use `useDashboardData` hook (already exists) to fetch metrics, upcoming tasks, and activity feed data
- Keep existing "People I Need to Connect With" section in the middle
- Layout order:
  1. Personal Metrics (4 cards grid)
  2. My Upcoming Tasks (scheduled interactions with complete/overdue)
  3. People I Need to Connect With (existing)
  4. Team Activity Feed

**`src/components/dashboard/UpcomingTasks.tsx`**
- Minor update: replace simple circle icon with `ScheduledTaskItem` component for checkbox completion support, OR keep as-is since `ScheduledTaskItem` already exists and we can use `useAllScheduledTasks` with it directly in TasksPage

### No new components needed
All widgets (`PersonalMetrics`, `UpcomingTasks`, `TeamActivityFeed`, `ScheduledTaskItem`) already exist. The data hooks (`useDashboardData`, `useAllScheduledTasks`) also exist. This is purely a composition change in `TasksPage.tsx`.




## Fix: Bulk Reassign Dialog Not Showing Team Members

### Problem Identified
The "Reassign People" dialog is only showing the "Unassigned" option, with no team members visible. After investigation:

1. **Database confirms 1 team member exists**: Alex Yarmolatii is correctly stored in `pipeline_team_members` for this flow
2. **Profile data is valid**: Alex's profile exists with `full_name` and `email`
3. **Session replay shows**: "Alex Yarmolatii" element was removed from DOM after a "Team member added successfully" toast

### Root Cause
The `teamMembers` array is empty when passed to `BulkReassignDialog`. This appears to be a timing/state issue where:
- The `useFlowTeamMembers` hook fetches data asynchronously
- The `loading` state from the hook is NOT being used to prevent rendering
- When a new team member is added, the `flowTeamMembers` state isn't refreshed

Additionally, there's a broader UX issue: the dialog currently shows only **flow team members**, but users may expect to see **all organization members** they can assign to.

### Solution

#### 1. Add Loading State Handling
Prevent the dialog from rendering team members before data is loaded.

**File: `src/components/crm/FlowView.tsx`**
Pass the loading state to `BulkActionsToolbar`:
```typescript
<BulkActionsToolbar
  ...
  teamMembers={teamMembers}
  teamMembersLoading={teamMembersLoading}  // Add this
  ...
/>
```

**File: `src/components/crm/BulkActionsToolbar.tsx`**
Accept and pass the loading state:
```typescript
interface BulkActionsToolbarProps {
  ...
  teamMembersLoading?: boolean;
}
```

**File: `src/components/crm/BulkReassignDialog.tsx`**
Show a loading skeleton when data is loading:
```typescript
interface BulkReassignDialogProps {
  ...
  isLoading?: boolean;
}

// In the render:
{isLoading ? (
  <div className="space-y-2">
    <Skeleton className="h-14 w-full" />
    <Skeleton className="h-14 w-full" />
  </div>
) : (
  // existing team member buttons
)}
```

#### 2. Refresh Team Members After Adding
When a new team member is added in FlowSettingsDialog, dispatch an event to refresh the team members.

**File: `src/components/crm/FlowSettingsDialog.tsx`**
After successfully adding a team member:
```typescript
// After successful insert
window.dispatchEvent(new CustomEvent('flow-team-updated'));
```

**File: `src/hooks/useFlowTeamMembers.tsx`**
Listen for the refresh event:
```typescript
useEffect(() => {
  const handleRefresh = () => fetchTeamMembers();
  window.addEventListener('flow-team-updated', handleRefresh);
  return () => window.removeEventListener('flow-team-updated', handleRefresh);
}, [flowId]);
```

#### 3. (Optional Enhancement) Show All Organization Members
For better UX, consider changing the reassign dialog to show all organization members, not just flow team members. This allows reassigning to anyone in the org, even if they're not explicitly on the flow's team.

This would require:
- Fetching organization members in `FlowView` (similar to `FlowSettingsDialog`)
- Passing org members to `BulkReassignDialog`
- Adding the user to `pipeline_team_members` automatically when assigned

### Files to Modify

| File | Change |
|------|--------|
| `src/components/crm/FlowView.tsx` | Pass `teamMembersLoading` prop |
| `src/components/crm/BulkActionsToolbar.tsx` | Accept and pass loading state |
| `src/components/crm/BulkReassignDialog.tsx` | Add loading skeleton UI |
| `src/hooks/useFlowTeamMembers.tsx` | Add event listener for refresh |
| `src/components/crm/FlowSettingsDialog.tsx` | Dispatch event after adding member |

### Technical Flow

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    Current Flow (Broken)                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FlowView mounts                                                        │
│       │                                                                 │
│       ▼                                                                 │
│  useFlowTeamMembers fetches... (async)                                  │
│       │                                                                 │
│       ▼                                                                 │
│  User opens BulkReassignDialog ◄── teamMembers may still be []         │
│       │                                                                 │
│       ▼                                                                 │
│  Dialog shows only "Unassigned" ✗                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    Fixed Flow                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FlowView mounts                                                        │
│       │                                                                 │
│       ▼                                                                 │
│  useFlowTeamMembers fetches... (async, loading=true)                   │
│       │                                                                 │
│       ▼                                                                 │
│  User opens BulkReassignDialog                                          │
│       │                                                                 │
│       ├─► If loading=true: Show skeleton                               │
│       │                                                                 │
│       ├─► When loading=false: Show team members ✓                      │
│       │                                                                 │
│       ▼                                                                 │
│  Data loads → Dialog re-renders with team members ✓                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Expected Behavior After Fix
1. User clicks "Reassign" button
2. Dialog opens with loading skeleton (brief moment)
3. Team members load and display (Alex Yarmolatii visible)
4. User can select a team member or "Unassigned"
5. When new team members are added in settings, the list refreshes


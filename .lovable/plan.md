

## Fix: Flow View Not Updating After Adding Contact from People Page

### Problem Identified
The database confirms the contact "TEST" was correctly added to the "Online Made Decision" flow in the "Decision Made" stage. The issue is that the **FlowContext doesn't refresh** when contacts are added from the People page.

The FlowContext only listens for these events:
- `pco-sync-complete` (PCO sync)
- `flow-assignment-updated` (assignment changes)
- `flows-created` (new flows created)

There's no event for "contact added to flow from external page."

### Solution: Dispatch Custom Event After Flow Enrollment

When a contact is added to a flow from the Contacts page, dispatch a custom event that the FlowContext is already set up to handle.

### Implementation

#### 1. Add Event Dispatch in ContactsPage.tsx

After successfully adding a contact to a flow, dispatch the `flow-assignment-updated` event to trigger a FlowContext refresh:

```typescript
// In handleSaveContact, after successful pipeline_contacts insert:
if (flowData && newContact) {
  const { error: flowError } = await supabase
    .from('pipeline_contacts')
    .insert({ ... });

  if (!flowError) {
    // Dispatch event to refresh FlowContext
    window.dispatchEvent(new CustomEvent('flow-assignment-updated'));
    toast.success(`Contact "${contact.name}" added and enrolled in flow!`);
  }
}
```

#### 2. Alternative: Add Query Invalidation for Flow Data

We could also add React Query invalidation for flow-related queries, but since FlowContext uses its own state management (not React Query), the custom event approach is the cleanest solution that works with the existing architecture.

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/ContactsPage.tsx` | Add `window.dispatchEvent(new CustomEvent('flow-assignment-updated'))` after successful flow enrollment |

### Technical Details

- The FlowContext already listens for `flow-assignment-updated` events (line 402 in FlowContext.tsx)
- When this event fires, it calls `refreshFlows()` which reloads all pipeline data from the database
- This ensures the Flow page will show newly added contacts without requiring a manual page refresh

### Expected Behavior After Fix
1. User opens "Add New Contact" dialog on People page
2. User fills in contact details and checks "Add to a flow"
3. User selects "Online Made Decision" flow and "Decision Made" stage
4. User clicks Save
5. Contact is saved to database AND `flow-assignment-updated` event is dispatched
6. If FlowContext is mounted (user navigates to Flows), it will have fresh data
7. If user is already on a Flow page in another tab, that page will refresh automatically

### Immediate Workaround
The "TEST" contact IS in the database. Simply **refresh the Flow page** (F5 or Cmd+R) and the contact will appear in the "Decision Made" stage.


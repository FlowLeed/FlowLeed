

## Improve Sync Toast Message

**Goal**: Show a friendlier "Everything is up to date" message instead of "Synced 0 people" when no changes are found.

### Change

**File: `src/pages/IntegrationsPage.tsx`** (around line 388-392)

Update the toast logic in the `else` branch to check if `totalContacts` is 0:

```
if (data?.totalContacts === 0) {
  toast.success("Everything is up to date", {
    description: "No new or updated people found since the last sync"
  });
} else {
  toast.success("Sync completed", {
    description: `Synced ${data?.totalContacts || 0} people`
  });
}
```

This is a single conditional check -- no other files need to change.


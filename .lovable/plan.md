

## Add Public Group Directory Link to Groups Page

### Overview

Add a button/link in the Groups page header that opens the public group directory (`/groups/directory`) in a new tab. This allows staff to easily share or preview what the public sees.

---

### Change

**File:** `src/pages/GroupsPage.tsx`

Add an "External Link" icon import and a secondary button next to "Create Group":

```text
Header section (lines 48-59) will become:

<div className="flex items-center justify-between">
  <div>
    <h1>Groups</h1>
    <p>Manage your small groups, serving teams, and classes</p>
  </div>
  <div className="flex items-center gap-2">
    <Button variant="outline" asChild>
      <a href="/groups/directory" target="_blank" rel="noopener noreferrer">
        <ExternalLink className="h-4 w-4 mr-2" />
        Public Directory
      </a>
    </Button>
    <Button onClick={() => setCreateDialogOpen(true)}>
      <Plus className="h-4 w-4 mr-2" />
      Create Group
    </Button>
  </div>
</div>
```

---

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/GroupsPage.tsx` | Add `ExternalLink` import from lucide-react, add "Public Directory" button that opens `/groups/directory` in new tab |

---

### Result

Staff will see a "Public Directory" button next to "Create Group" that opens the public-facing group directory in a new browser tab, making it easy to preview or share.


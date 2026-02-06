
## Activate Groups Feature and Add Signup Request Management

### Overview

The Groups module is fully built but hidden behind a "Coming Soon" flag. This plan activates it and adds the missing signup request management UI.

---

### Phase 1: Activate Groups in Navigation

**File:** `src/components/layout/Sidebar.tsx`

Remove the `comingSoon: true` flag from the Groups navigation item (line 449-451):

```text
Before:
  title: "Groups"
  icon: UsersRound
  path: "/groups"
  comingSoon: true

After:
  title: "Groups"
  icon: UsersRound
  path: "/groups"
```

---

### Phase 2: Add Signup Request Management

Create a system for group leaders to view and process pending signup requests.

#### 2.1 Create Hook: `useGroupSignupRequests`

**New File:** `src/hooks/useGroupSignupRequests.tsx`

- Fetch pending signup requests for a group
- Provide mutations for: approve, reject
- Handle toast notifications

```text
Functions:
- useGroupSignupRequests(groupId)
  - Returns: requests, isLoading, approveRequest, rejectRequest
  
- approveRequest:
  1. Create contact if needed (if contact_id is null)
  2. Add as group_member
  3. Update request status to 'approved'
  
- rejectRequest:
  1. Update request status to 'rejected'
```

#### 2.2 Create Dialog: `SignupRequestsDialog`

**New File:** `src/components/groups/SignupRequestsDialog.tsx`

Dialog to view and process pending signup requests:

- Shows list of pending requests with name, email, phone, date
- Actions: Approve (adds to group) or Reject
- Badge count for pending requests
- Empty state when no pending requests

#### 2.3 Update GroupDetailPage

**File:** `src/pages/GroupDetailPage.tsx`

Add a button/badge in the header area showing pending signup requests count:

- Add "Signup Requests (N)" button next to "Edit Group"
- Opens SignupRequestsDialog
- Only show if allow_public_signup is enabled
- Badge shows count of pending requests

---

### Phase 3: Wire Up Approval Flow

When a request is approved:

1. **If contact exists (contact_id not null):**
   - Create group_member linking to existing contact
   
2. **If contact doesn't exist (contact_id is null):**
   - Create new contact in organization
   - Create group_member linking to new contact
   - Update signup request with new contact_id

3. **Update request:**
   - Set status to 'approved'
   - Set processed_at to now()
   - Set processed_by_user_id to current user

---

### Files Summary

| File | Action |
|------|--------|
| `src/components/layout/Sidebar.tsx` | Edit - Remove comingSoon flag |
| `src/hooks/useGroupSignupRequests.tsx` | Create |
| `src/components/groups/SignupRequestsDialog.tsx` | Create |
| `src/pages/GroupDetailPage.tsx` | Edit - Add signup requests button |

---

### Testing Checklist

After implementation:

1. Navigate to Groups from sidebar (should no longer show "Coming Soon")
2. Create a new group
3. Enable public signup in group settings
4. Copy public signup link and submit a test signup
5. Return to group detail page and see the signup request
6. Approve the request and verify member is added
7. Test rejecting a request

---

### Technical Notes

- No database changes needed (tables and RLS already exist)
- No edge function changes needed (signup already works)
- Contact creation on approval should use org's organization_id from the group
- All existing components are production-ready



## Assign Group Leader

Add a searchable leader assignment field to the Edit Group dialog, allowing users to search for organization team members by name and assign them as the group leader.

### What will change

1. **Edit Group Dialog** - A new "Group Leader" section will be added with a searchable dropdown (using the existing `Command` component pattern from `AddGroupMemberDialog`). Users can search organization members by name, see their avatar, and select one as the leader. A "Remove" option will allow unsetting the leader.

2. **Group Detail Page** - The leader's name will be displayed in the group header area so it's visible at a glance.

3. **Create Group Dialog** - The same leader selector will be available when creating a new group.

### Technical Details

**Leader Selector Component** (`src/components/groups/LeaderSelector.tsx`)
- New reusable component that queries `organization_members` joined with `profiles` to get team members
- Supports search by name (using `ilike` on `profiles.full_name`)
- Shows avatar, name, and role for each team member
- Selected leader displayed with avatar and a "Change" button
- Stores the selected `user_id` value

**Edit Group Dialog changes** (`src/components/groups/EditGroupDialog.tsx`)
- Add `leader_user_id` to the form state, initialized from `group.leader_user_id`
- Render the `LeaderSelector` component between the Location field and Public Access Settings
- Include `leader_user_id` in the update payload

**Group Detail Page changes** (`src/pages/GroupDetailPage.tsx`)
- Fetch the leader's profile (name, avatar) when `group.leader_user_id` is set
- Display the leader info in the header or info cards section

**Create Group Dialog changes** (`src/components/groups/CreateGroupDialog.tsx`)
- Add the same `LeaderSelector` for new groups

**Data flow:**
- Query: `organization_members` joined with `profiles` table, filtered by `organization_id`
- Write: `groups.leader_user_id` column (already exists in schema)
- No database migrations needed


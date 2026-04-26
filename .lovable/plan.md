

# Improved Team Member Onboarding with Flow Pre-Assignment

## Overview

Add a **"Add to Flows"** option in the Invite Team Member dialog. The inviter selects which flows the new teammate should join. When they accept the invite and create their account, they're auto-assigned as a team member (lead) on those flows and see them immediately on first login.

## User Flow

```text
Admin clicks "Invite Team Member"
        ↓
Fills email + role
        ↓
NEW: Toggles "Add to Flows" → compact searchable list of org flows (multi-select)
        ↓
Sends invite (flows stored with invitation)
        ↓
Invitee clicks email link → creates account → accepts invite
        ↓
NEW: Auto-added to selected flows as 'lead'
        ↓
NEW: First-login welcome screen showing "You've been added to these flows" with quick links
```

## Changes

### 1. Database (migration)
- Add `pipeline_ids uuid[] DEFAULT '{}'` column to `invitations` table to store pre-selected flows.

### 2. Edge Function — `create-invitation`
- Accept new `pipelineIds: string[]` field in request body.
- Validate each pipeline belongs to the org.
- Store on the invitation row.
- Mention selected flow names in the invitation email ("You'll be added to: Plan Your Visit, Baptism").

### 3. Edge Function — `accept-invitation`
- After adding user to `organization_members`, loop through `invitation.pipeline_ids` and insert into `pipeline_team_members` with role `'lead'` (skip duplicates via `ON CONFLICT`).

### 4. Frontend — `InviteTeamMemberDialog.tsx`
- Add compact, searchable flow picker (Command/Checkbox list of org flows, max-height with scroll).
- "Add to Flows" optional section, collapsed by default. Shows "X flows selected" badge.
- Pass `pipelineIds` to the edge function call.

### 5. Frontend — Welcome screen for new members
Reuse existing `MemberOnboardingWizard.tsx`:
- Add a new first step: **"Your Assigned Flows"** that lists the flows from `useFlowTeamMembers`/`useMyFlows` with quick-jump links.
- Marks `flows_reviewed` complete once user clicks into any flow.

## Other Onboarding Improvements (recommended)

1. **Personal Welcome Email after acceptance** — separate email confirming successful join with a "Get Started" button linking to dashboard.
2. **Inviter notification** — notify the admin via in-app notification when their invitee accepts (uses existing `notifications` table).
3. **Default avatar prompt** — surface "Add a profile photo" as the very first onboarding step (already exists, just emphasize).
4. **Pre-assign first contact (optional, future)** — let inviter optionally hand off 1–2 contacts during invite for an immediate "first task."

## Technical Details

- **Schema diagram:**
  ```text
  invitations
    ├─ pipeline_ids uuid[]   (NEW)
    └─ ... existing fields
  
  On accept:
    organization_members  ← INSERT user
    pipeline_team_members ← INSERT (pipeline_id, user_id, 'lead') for each id
  ```
- **Validation:** edge function filters `pipelineIds` to only those whose `organization_id` matches the invitation's org (prevents tampering).
- **Idempotency:** `pipeline_team_members` insert uses `ON CONFLICT DO NOTHING`.
- **UI component:** Use shadcn `Command` + `Checkbox` inside a `Popover` for the multi-select flow picker, similar to existing patterns in `BulkMoveToFlowDialog.tsx`.
- **Email copy:** When `pipelineIds.length > 0`, append a section listing flow names so the invitee knows what they're walking into.

Ready to implement once approved.


# Form submission details in Flows

## What will change
- Add a small form/document icon to each Flow card and table row when that person has a submission connected to the current Flow.
- Clicking the icon opens a centered dialog without navigating away from the Flow.
- The dialog shows the form name, submitted date, submitter, and every submitted question and answer in a readable layout.
- If a person has multiple matching submissions, the dialog lets the leader review each one.
- Keep normal card, row, selection, and drag behavior unchanged; the icon click will not trigger those actions.

## Technical details
- Load matching `form_submissions` and form metadata once per Flow for the visible contact IDs, using the existing organization access rules.
- Share one reusable submission dialog and trigger control between Kanban cards, desktop table rows, and mobile rows.
- Match submissions by `contact_id` and limit the displayed set to forms routed to the current Flow.
- Use existing dialog, button, tooltip, and semantic color components.

## Verification
- Check cards and table rows with and without submissions.
- Confirm the centered dialog displays all answer types and multiple submissions correctly.
- Confirm clicking the icon does not open the contact profile, select the row, or begin a drag.

# Confirmed AI Prayer Requests

## Build
- Add **Create a prayer request** as a separate Action toggle inside My Organization → FlowLeed AI.
- Let FlowLeed AI prepare a prayer request only after identifying one verified person and collecting a title and request details.
- Show the person, title, and full request in the existing confirmation card before anything is saved.
- On confirmation, re-check the person and organization, save through the signed-in user's permissions, verify the saved request, then report success with a link to the person's profile.
- Support the confirmation button and direct replies such as “Yes,” “Confirm,” or “Save the prayer request.”

## Safety
- Keep the action disabled by default until an owner or admin enables it.
- Make confirmation single-use and expiring, and record preparation, success, and failure in the existing AI audit history.
- Never let AI-written text claim a prayer request was saved without a verified result.

## Verification
- Deploy the updated FlowLeed AI function and confirm the app builds cleanly.
- Authenticated end-to-end verification remains unavailable because this project uses externally managed sign-in.

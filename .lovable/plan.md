# Make FlowLeed AI actions reliable

## Confirmed cause
- The exact conversation was found: Matthias “Matt” Dudko, Alex’s Coffee, and its first step “Need to Check In” are all valid records in the same organization.
- The user is both the organization owner and Flow Owner, so permission was not the blocker.
- FlowLeed AI currently has only three read/search tools. It has no tool that can add someone to a Flow.
- After the user replied “Yes,” the model wrote a success-looking “Flow Update,” but no `pipeline_contacts` row was created. The database confirms Matt is not in Alex’s Coffee.
- The “2 names ... were removed” note is a second symptom: valid people mentioned earlier in the conversation are not carried into the current response’s link-validation context.

## Recommended fix

### 1. Replace conversational promises with a real pending action
- When FlowLeed AI proposes adding someone, attach a structured pending action containing the verified person, Flow, and destination step.
- Render an in-chat confirmation card: **Matt Dudko → Alex’s Coffee → Need to Check In** with **Confirm add** and **Cancel** actions.
- Keep natural-language replies such as “yes” working by resolving them against that pending action, rather than asking the model to reconstruct names and IDs.

### 2. Perform and verify the write
- Add a narrowly scoped server action that validates the authenticated user, organization, person, Flow, step, and Flow-team permission before inserting.
- Use the user’s authorization context so existing row-level security remains authoritative; do not bypass permissions with the admin client.
- Respect the existing unique person-plus-Flow rule: return “Already in this Flow” instead of failing or duplicating the person.
- Read the membership back after insertion before reporting success.

### 3. Make success and failure unmistakable
- Only show **Added to Alex’s Coffee** after the verified write succeeds.
- Include a direct **Open Flow** action and the destination step in the result.
- On failure, preserve the pending action and show the actual reason with **Try again**; never let the model turn an unexecuted action into success-style prose.
- Record the action result for troubleshooting without exposing internal instructions.

### 4. Fix conversation-aware person validation
- Validate people referenced across the full conversation, not only names returned by a tool in the latest request.
- Remove the incorrect “names were removed” note when previously verified people are mentioned in a follow-up action.

## Verification
- Reproduce the Matt → Alex’s Coffee scenario and confirm the database row, Flow count, and visible person card all update.
- Test typed “Yes,” the confirmation button, Cancel, duplicate membership, wrong-organization IDs, insufficient Flow permissions, invalid steps, and a failed insert followed by retry.
- Reload the conversation before confirming to ensure the pending action survives and cannot target a different person or Flow.

# Engagement Preview Popup

## What will change
- Open the Engagement Preview in a centered popup instead of adding results below the settings page.
- Keep the level totals, average score, people scored, and sampling estimate inside the popup.
- Show a small, clearly grouped set of people from every engagement level, rather than a list dominated by Highly Engaged people.
- Keep the popup scrollable on smaller screens with its heading and close action always accessible.

## Technical details
- Update the preview result layout to use the app's existing dialog components.
- Group sample contacts by engagement level in the interface and request balanced samples from the preview calculation.
- Preserve the current fast 2,500-person calculation limit and make no score changes until Save is used.
- Verify type checks, the app build, and the preview interaction.

# Move FlowLeed AI Tools into My Organization

## What will change
- Add a **FlowLeed AI** tab to **My Organization** beside the existing organization tabs.
- Reuse the current AI tool controls inside that tab, preserving permissions and behavior.
- Remove the separate **FlowLeed AI Tools** sidebar item.
- Redirect old `/settings/ai-tools` bookmarks to the new organization tab.
- Keep the tab row usable on smaller screens with horizontal scrolling.

## Technical details
- Extract the AI controls into a reusable settings section without its standalone page header.
- Select the new tab through the existing `?tab=` URL pattern.
- Update navigation and route wiring without changing any AI tool business logic or database behavior.
- Verify the build and the organization settings view.

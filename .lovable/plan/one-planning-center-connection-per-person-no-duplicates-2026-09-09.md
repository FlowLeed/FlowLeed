# One Planning Center connection per person, no duplicates

Today two Planning Center cards can show at once: the church-wide connection on the Integrations page, and a personal sign-in card on the Profile page (plus a nudge on the dashboard). For an admin who already set up the church-wide connection, the personal card looks like a second, broken connection.

## What changes

**Hide the personal Planning Center card for admins and owners.**
Admins and owners always see all church data anyway, so a personal sign-in adds nothing for them. The Profile card and the dashboard nudge only appear for regular team members.

**Only show it when it's actually needed.**
The personal card also stays hidden unless the church has a Planning Center connection set up and the "Restrict each user to their personal PCO visibility" setting is on. When that setting is off, everyone already sees church-wide data, so nothing needs connecting.

**Clearer wording so the two are never confused.**
- Profile card title: "Your Planning Center permissions", with a line explaining it is a personal sign-in used only to match what you can see in Planning Center — separate from the church connection.
- Integrations card: label it the church-wide connection and keep showing which Planning Center church it is connected to.

**Result**

| Who | Integrations page | Profile page |
| --- | --- | --- |
| Owner / admin | Church-wide connection (full data) | No Planning Center card |
| Team member, visibility restriction on | Not visible to them | Personal sign-in for permissions |
| Team member, restriction off | Not visible to them | No Planning Center card |

## Technical notes

- Gate `PcoPersonalConnection` in `src/pages/ProfilePage.tsx` (line 495) and `PcoPersonalConnectPrompt` in `src/pages/Dashboard.tsx` (line 50) on `useIsOrgAdmin(user?.id)` being false.
- Additional gate: the org has an active `integrations` row with `service_name = 'planning_center'` and its enforcement flag (the toggle behind `PcoEnforcementToggle.tsx`) enabled. Add a small shared hook, e.g. `useNeedsPersonalPco()`, returning `{ needed, isLoading }` so both call sites share one rule and render nothing while loading.
- Copy-only edits to `PcoPersonalConnection.tsx` header/description and the Integrations card heading in `IntegrationsPage.tsx`.
- No database or edge-function changes; existing personal connections keep working.

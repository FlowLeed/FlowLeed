## Goal
Remove the legacy Personal Access Token (API key) UI from the Planning Center integration card, since OAuth is now the only supported connection method for new connections.

## What changes — `src/pages/IntegrationsPage.tsx`

1. **Remove the "Quick Setup Guide" block** (lines 637–675) — the PAT setup walkthrough pointing to `personal_access_tokens`.
2. **Remove the Client ID / Secret form and its buttons** (lines 677–702), including the "Get API Keys" outbound link. The OAuth "Connect Planning Center" CTA already lives above it (lines 622–635) and remains the sole entry point.
3. **Simplify the conditional** so that when no integration exists, only the OAuth CTA renders; when one exists, the connected/management UI renders unchanged.
4. **Delete now-unused code**:
   - `planningCenterForm` state and its `setPlanningCenterForm` resets in mutation `onSuccess` / `onSettled`.
   - `createIntegrationMutation` (PAT-based insert + test).
   - `handlePlanningCenterConnect` handler.
   - `Key` icon import (no longer referenced).

## What stays
- OAuth connect CTA, reauth banner, PAT→OAuth migration banner (still useful for orgs already on legacy PAT).
- `deleteIntegrationMutation`, `testConnectionMutation`, sync UI, list mapping, advanced settings.
- Backend edge functions and DB schema — untouched.

## Out of scope
- Removing PAT support from edge functions or the DB (existing PAT integrations keep working until users migrate).
- Changes to `IntegrationAdvancedSettingsPage.tsx` or other pages.

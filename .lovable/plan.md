
# Switch Amplitude to `@amplitude/unified` (Analytics + Session Replay)

The Amplitude wizard prompt specifies the `@amplitude/unified` package (which bundles Analytics + Session Replay) and a specific `initAll(...)` call with the API key hardcoded. We previously installed `@amplitude/analytics-browser`. This plan migrates to the wizard's recommended setup.

## Changes

1. **Swap the npm package**
   - Remove `@amplitude/analytics-browser`
   - Install `@amplitude/unified`

2. **Rewrite `src/lib/analytics.ts`**
   - Import `* as amplitude from '@amplitude/unified'`
   - Replace `initAnalytics()` with a single `initAll` call:
     ```ts
     amplitude.initAll('b13e88c41d7f13678b0c273d876e067c', {
       analytics: { autocapture: true },
       sessionReplay: { sampleRate: 1 },
     });
     ```
   - Keep the `initialized` guard so init only runs once per app lifecycle
   - Keep helper exports already used elsewhere: `identifyUser`, `resetUser`, `trackEvent`
   - Remove the `VITE_AMPLITUDE_API_KEY` env-var path (wizard says hardcode the key; it's a publishable client-side key)

3. **`src/main.tsx`** — unchanged; it already calls `initAnalytics()` once at module load (client-side only, before React renders). This satisfies the "initialize once" and "client-side only" rules.

4. **`src/hooks/useAuth.tsx`** — unchanged; continues to call `identifyUser` on sign-in and `resetUser` on sign-out.

## Notes / Rules compliance

- This is a JavaScript (React + Vite) app → SDK install is appropriate.
- All Amplitude code lives in `src/` and runs only in the browser (no SSR in this project).
- `initialized` flag + module-level singleton ensures `initAll` runs exactly once.
- No new event-tracking call sites added in this pass — `autocapture: true` + `sessionReplay.sampleRate: 1` covers page views, clicks, form interactions, sessions, and full session replay automatically. Custom `trackEvent(...)` calls can be sprinkled into business handlers in a follow-up.

## Verification steps (after build)

1. Reload the preview and open the browser console — confirm no Amplitude warnings/errors.
2. Click around the app to fire autocaptured events.
3. Check the Amplitude dashboard (or the setup page that issued this wizard) to confirm events arrive.
4. Once confirmed, ship to production.

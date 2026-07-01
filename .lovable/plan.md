Add a `useGoogleAnalyticsPageView` hook inside `BrowserRouter` that listens to React Router location changes and emits a `page_view` event to GA4 on each route change. It will report the full path + search params and the current `document.title`, avoiding duplicates on initial load since the first `page_view` is already sent by the gtag config in `index.html`.

### Changes
1. Create `src/hooks/useGoogleAnalyticsPageView.ts`:
   - Import `useLocation` from `react-router-dom`.
   - On each location change, call `window.gtag('event', 'page_view', { ... })` with:
     - `page_path`: `location.pathname + location.search`
     - `page_location`: `window.location.href`
     - `page_title`: `document.title`
   - Guard `window.gtag` so it safely does nothing if the tag is blocked or not loaded yet.
2. Add the hook to `src/App.tsx` inside `<BrowserRouter>` so it activates for all route changes.

### Notes
- First page view on initial load is already sent by `gtag('config', 'G-KP1CLD5CDD')` in `index.html`, so we will not send an extra event on mount.
- Works with both public and authenticated routes.
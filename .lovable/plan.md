# Plan: Progressive Web App + Push Notifications

## Current state

- React + Vite app, no manifest, no service worker, no PWA tooling installed.
- `index.html` has basic meta + Inter font, no mobile-app meta tags, no manifest link, no apple-touch icons.
- Notifications today are in-app only (`useNotifications` + realtime Postgres subscription on `notifications` table) and a daily email digest (`send-daily-digest` edge function). `NotificationSettings` only toggles the email digest.
- Supabase backend is in place — easy to add a `push_subscriptions` table + an edge function to send pushes.
- No native wrapper is needed; the goal is web-based install + push.

## What we'll build

### 1. Installable PWA (manifest-only, no aggressive service worker caching)

Lovable previews live in iframes, so a heavy caching service worker breaks the editor. We'll use the lightweight pattern: a real manifest + icons for "Add to Home Screen", and a **minimal service worker only for push notifications** (no offline HTML caching, no `navigateFallback`).

- Add `public/manifest.webmanifest` with name "Flow", short_name "Flow", `display: standalone`, theme/background colors from the design tokens, `start_url: /`, `scope: /`.
- Generate icon set (192, 512, maskable 512, apple-touch 180) into `public/icons/` using the existing Flow brand.
- Update `index.html`:
  - `<link rel="manifest">`, `<link rel="apple-touch-icon">`
  - `<meta name="theme-color">`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`
  - Proper viewport with `viewport-fit=cover` for iOS safe areas
- Add a small `InstallPrompt` component:
  - Listens for `beforeinstallprompt` (Android/desktop Chrome) and shows a "Install Flow" button in the header or profile page.
  - Detects iOS Safari and shows the "Share → Add to Home Screen" instructions (since iOS doesn't fire `beforeinstallprompt`).
  - Hides itself when `display-mode: standalone` is active.
- Guard the push service worker registration so it does **not** register inside the Lovable preview iframe / preview host (so the editor stays clean). It only activates on the published domain.

### 2. Web Push notifications

Uses the standard Web Push API (VAPID). Works on Chrome/Edge/Firefox/Android, and on iOS 16.4+ **only after the user installs the PWA to home screen**.

**Database** (new migration):
- `push_subscriptions` table: `id`, `user_id`, `endpoint` (unique), `p256dh`, `auth`, `user_agent`, `created_at`, `last_used_at`.
- RLS: users can insert/select/delete only their own rows; `service_role` full access.
- Add `push_enabled boolean default false` to `profiles` (or extend existing notification prefs row if one exists).

**Service worker** (`public/sw-push.js`):
- `push` event → `showNotification(title, { body, icon, badge, data: { url } })`
- `notificationclick` event → `clients.openWindow(data.url)` (focus existing tab if open)
- No fetch/caching handlers — keeps it safe alongside the dev preview.

**Client**:
- `src/lib/push.ts`: helpers to register the SW, request `Notification.permission`, call `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })`, POST subscription to an edge function that stores it, and an `unsubscribe` flow.
- VAPID public key shipped via `VITE_VAPID_PUBLIC_KEY` (publishable, safe in frontend).
- Extend `NotificationSettings` with a "Push notifications" toggle showing browser permission state, install hint for iOS, and a "Send test notification" button.

**Edge functions** (new):
- `push-subscribe` — auth'd, upserts a row in `push_subscriptions` for the current user.
- `push-unsubscribe` — auth'd, deletes by endpoint.
- `send-push` — internal helper used by other backend code. Takes `{ user_id, title, body, url, tag }`, looks up the user's subscriptions, signs JWTs with VAPID keys, POSTs to each endpoint. Deletes rows that come back 404/410 (stale).
- `send-test-push` — auth'd, sends a test notification to the caller's subscriptions.

**Wire pushes into existing notification creation**:
- Find the places that currently `insert` into the `notifications` table (assignment notifications, mentions, etc.) — either:
  - **Option A (recommended):** add a Postgres trigger on `notifications` that calls a small `pg_net` request to `send-push` so any future in-app notification automatically also fires a push. One integration point, future-proof.
  - **Option B:** call `send-push` from each edge function that creates a notification.

**Secrets** (added via secrets tool, not committed):
- `VAPID_PUBLIC_KEY` (also exposed to the client as `VITE_VAPID_PUBLIC_KEY`)
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (e.g. `mailto:support@flowleed.com`)

### 3. UX polish

- Add a one-time prompt (after sign-in, dismissible, stored in `profiles.push_prompt_dismissed_at`) asking the user to enable push.
- Show an "Install app" card in `ProfilePage` next to the existing notification settings, with platform-aware copy (Android install button, iOS instructions, "Already installed ✓" when standalone).
- Standalone-mode CSS tweak: add `env(safe-area-inset-*)` padding to the header/sidebar so it looks right on installed iOS.

## Out of scope (explicit non-goals)

- Offline support / caching of API responses — would conflict with the live realtime CRM model and the Lovable preview. Can be added later if needed.
- Native iOS/Android apps via Capacitor — separate path, not needed for push on iOS 16.4+ installed PWA.
- Background sync / periodic sync.

## Rollout order

1. Manifest + icons + meta tags + InstallPrompt (ship installability).
2. DB migration for `push_subscriptions` + profile flag.
3. VAPID secrets + service worker + client subscribe flow + settings UI.
4. `send-push` edge function + test-push button (verify end-to-end).
5. Hook into `notifications` table (trigger) so existing assignment / mention notifications start delivering as pushes.
6. Optional: post-login enable-push prompt.

## Technical notes

- Use `web-push` style VAPID signing in Deno via `npm:web-push` in the edge function (works in Supabase Edge Functions).
- Service worker registration guard:
  ```ts
  const isPreview = location.hostname.includes('lovableproject.com') || location.hostname.includes('id-preview--');
  const inIframe = window.self !== window.top;
  if (!isPreview && !inIframe && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw-push.js');
  }
  ```
- iOS requirement: push only works when launched from the home-screen icon AND on iOS 16.4+. The UI must communicate this.
- Browser permission is a one-shot — if denied, we cannot re-prompt; UI must instruct the user to re-enable via browser settings.

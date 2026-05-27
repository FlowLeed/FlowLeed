## Finalize PWA Push Notifications

All code is in place (service worker, edge functions, subscribe UI, install prompt). Final step is configuring the three VAPID secrets so the backend can sign and send push messages.

### Steps

1. **Add VAPID secrets** via the secrets prompt:
   - `VAPID_PUBLIC_KEY` = `BBGrIhcN1uGC0029qLFCfP4iy4Mb0LbUfTiIxnmJ0k5_d6BV1A5CocKNB6gpwB_yADHPHPBLcUCVY0XeGMmaPmk`
   - `VAPID_PRIVATE_KEY` = `46v0tL6ei_l-9NU6BNxNpZgsG_ZQ-eFACCUs33J8rR0`
   - `VAPID_SUBJECT` = `mailto:support@flowleed.com`

2. **Apply the pending DB migration** that creates `push_subscriptions` (with RLS + grants) and the `notify_push_on_notification` trigger so any row inserted into `notifications` auto-fans-out a web push via `pg_net` → `send-push`.

3. **Verify end-to-end** after deploy:
   - Open published app (`app.flowleed.com`) on desktop Chrome and iOS (after Add to Home Screen).
   - Profile → enable Push → "Send test" → confirm OS-level notification.
   - Trigger a real notification (assignment) → confirm push arrives and click opens correct URL.

### Notes

- Push will not work inside the Lovable preview iframe by design (`isInPreviewIframe` guard). Test on the published URL.
- iOS requires the app to be installed to Home Screen first; the UI already shows that hint.
- Stale endpoints (404/410) are auto-cleaned by `send-push`.

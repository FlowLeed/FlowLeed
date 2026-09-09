# Why The Promise Center has no attendance and no Planning Center data

## What I found

The Planning Center connection for The Promise Center is pointing at the **wrong Planning Center church account**.

- Every staff member's personal Planning Center connection points to church account `134069` (the real Promise Center, ~20,700 people visible).
- The church-wide connection, reconnected on **Aug 19, 2026 at 6:57 PM**, points to a different account: `507508`, labeled "Admin Account".
- The first sync after that reconnect (Aug 20, 12:46 AM) pulled **30 people total, 1 page** — that account is essentially empty. Before then the org had 17,999 people synced.
- Since Aug 20 exactly **30 of 17,999** people records have been touched. Nothing else has updated in three weeks.

Because everything Planning Center-related reads through that church-wide connection:

- **Pastoral Context is blank** and the field picker shows "No fields found" — the empty account has no custom field definitions, and people like Alex Barquero don't exist in it.
- **Attendance / check-ins stopped.** Check-ins were last imported in bulk on **Mar 14, 2026** (101,748 records), with a tiny trickle of 5 on Jul 26 and nothing since. The automatic check-in job has run but recorded `last_checkin_count: 0` — the account it queries has no check-ins.

So there are two separate problems:

1. **Aug 19–20:** the reconnect bound the church to the wrong Planning Center account. This broke people, custom fields, groups and check-ins all at once.
2. **Since mid-March:** check-in syncing was already only catching a trickle. It runs incrementally on "updated since last sync", and Planning Center rarely marks past check-ins as updated, so newly created check-ins were being missed even before the reconnect.

## Fix

### 1. Reconnect to the right church (immediate)
Reconnect Planning Center while signed into the real Promise Center account, so the church-wide connection is bound to account `134069` again. Then run a full people sync plus a full check-in backfill.

### 2. Prevent picking the wrong account again
On reconnect, compare the Planning Center account being connected to the one the church was previously connected to. If it differs, show a clear confirmation ("You're connecting Admin Account, but this church was previously synced with The Promise Center — continue?") instead of silently switching.

### 3. Fix check-in syncing so attendance keeps flowing
Query check-ins by when they happened, not by when they were last edited, so new attendance is always picked up. Backfill the gap from March to today.

### 4. Notice breakage sooner
When a sync that previously covered thousands of people suddenly returns a handful, flag it on the integrations page instead of quietly recording success.

## Technical notes

- `integrations` row `de7da532-…`: `provider_account_id = 507508`, `provider_account_name = "Admin Account "`, created `2026-08-19T18:57:34Z`, scopes `openid people services check_ins giving groups`. All `user_pco_connections` rows carry `provider_account_id = 134069`.
- Last `pco_sync_jobs` row: `auto_full_people_sync`, completed `2026-08-20T00:48:05Z`, `total_contacts: 30`, `pages_fetched: 1`.
- Integration metadata: `last_checkin_sync_at: 2026-08-27T18:30:42Z`, `last_checkin_count: 0`.
- `pco_checkins` for this org by insert day: 20,984 (Mar 13), 80,764 (Mar 14), 5 (Jul 26).
- Account guard goes in `pco-oauth-callback` / `pco-oauth-confirm`, surfaced in `IntegrationsPage.tsx`.
- Check-in window change in `supabase/functions/pco-sync-checkins/index.ts`: replace `where[updated_at][gte]` with a `created_at`/`checked_in_at` window plus a bounded overlap, keeping the existing cursor/paging.
- Backfill by clearing `last_checkin_sync_at` (and any stale `checkin_sync_cursor`) after the reconnect, then draining `pco-checkin-auto-sync`.

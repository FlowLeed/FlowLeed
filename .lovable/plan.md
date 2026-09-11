# Why "Attended Sunday recently" shows 0 — and how to fix it

## What I found

For The Promise Center, the stored signal results were last calculated on **Sept 7**. Every check-in that arrived after that (about 1,100 check-ins imported Sept 9–11, including last Sunday's) has never been counted.

Verified in the data:
- The org's signal results all carry a single timestamp: 2026-09-07 06:45.
- 702 people in that org have a service check-in in the last 14 days, so the signal should be showing hundreds, not 0.
- Attendance-based signals (recent attendance, consistent attender, missed Sundays, served recently) have no stored rows at all for this org, while group and salvation signals do — consistent with the attendance data landing after the last calculation.

Root cause: nothing recalculates signals automatically. The recalculation runs only when someone triggers it from the Signals screen. Other churches happen to show correct numbers because their results were recalculated recently; this one went stale.

## Plan

1. **Recalculate right after check-in data arrives.** The scheduled check-in import (and the groups import) will trigger a signal recalculation for each org it just updated, so numbers reflect the newest attendance within minutes of the import.
2. **Add a nightly safety net.** A scheduled job recalculates signals for every organization once a day, so no church can drift out of date even if an import is skipped.
3. **Make freshness visible on the Signals page.** Show "Updated <time>" with a Refresh button, so anyone can see whether the numbers are current and update them on the spot.
4. **Backfill now.** Recalculate The Promise Center immediately so the page shows real counts today.

## Technical notes

- Call `public.recompute_contact_markers(p_org_id)` at the end of the per-org loop in `pco-checkin-auto-sync` (and `pco-groups-auto-sync`), guarded so a failure logs and does not fail the sync.
- New pg_cron job (e.g. 04:30 UTC) invoking a small edge function that loops orgs with contacts and calls the same RPC; the existing cron list has no marker recompute job today.
- `SignalsPage.tsx`: read `max(computed_at)` from `contact_markers` for the org (or extend `get_marker_catalog`), render it next to the summary cards, wire the existing `useRecomputeMarkers` mutation to the Refresh button.
- No schema change required.

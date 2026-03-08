

## Problem: `pco-sync-checkins` Edge Function Not Deployed

The function code exists in `supabase/functions/pco-sync-checkins/index.ts` and is registered in `config.toml`, but it has **never been deployed** to Supabase — there are zero logs, zero network requests hitting it, and zero rows in `pco_checkins`.

Similarly, `pco-checkin-auto-sync` (Phase 4) likely needs deployment too.

## Plan

1. **Deploy `pco-sync-checkins`** using the edge function deployment tool
2. **Deploy `pco-checkin-auto-sync`** using the edge function deployment tool
3. **Test `pco-sync-checkins`** by invoking it with a valid integration ID to confirm it works end-to-end
4. **Verify data** — query `pco_checkins` and `contact_engagement_scores` tables after invocation

## Technical Detail

Both functions were created as code files but the deployment step was missed during the phased implementation. Once deployed, clicking "Sync Check-Ins" in the UI should work immediately since the client-side hook (`useSyncCheckins`) and button are already wired up correctly.


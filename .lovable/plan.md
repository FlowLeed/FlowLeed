


## PCO Check-Ins Integration

### Completed (Phase 1-3)

**Database:**
- `pco_checkins` table with RLS, dedup on `pco_checkin_id`
- `contact_engagement_scores` table with RLS
- `calculate_engagement_scores(p_org_id)` DB function (scoring 0-100 with engagement levels)

**Edge Function:**
- `pco-sync-checkins` - fetches from PCO Check-Ins API, matches contacts, upserts check-ins, calculates engagement scores
- Supports incremental sync via `last_checkin_sync_at` in integration metadata

**UI:**
- "Sync Check-Ins" button in SyncSettingsSection (PCO integration settings)
- `EngagementBadge` component on TaskContactRow (compact score) and contact profiles
- Check-in entries in InteractionTimeline (`checkin` type with teal styling)
- `AttendanceSection` in Analytics page with check-in metrics + engagement distribution pie chart
- `useCheckinData` hook with `useEngagementScore`, `useContactCheckins`, `useSyncCheckins`, `useOrgCheckinStats`

### Completed (Phase 4)
- Cron-based auto-sync for check-ins (`pco-checkin-auto-sync` edge function, runs every 6 hours)
- Flow filtering by engagement level (filter popover in FlowHeaderFilters)

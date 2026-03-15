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

### Completed (Phase 5 - Chunked Sync)
- **Problem**: Large orgs (13k+ check-ins) caused timeout before upsert phase — zero data written
- **Fix**: Chunked pagination (max 30 pages / ~3k records per invocation) with cursor-based resume
- `pco-sync-checkins` saves cursor in `integrations.metadata.checkin_sync_cursor` and returns `hasMore`
- `pco-checkin-auto-sync` loops up to 10 rounds per org until `hasMore: false`
- `useSyncCheckins` hook auto-continues up to 15 rounds with progress toasts
- Stale cursor cleanup (>2 hours) in auto-sync
- Reset `last_checkin_sync_at` for orgs with 0 checkin data via migration

### Completed (Phase 6 - Household Check-ins)
- `useContactCheckins` expanded to fetch check-ins from all household members via `pc_household_id`
- Deduplication by event+date (own check-in preferred over household)
- `ContactCheckinsCard` shows "Includes household" badge and "Checked in by" column
- Household rows rendered with subtle opacity to distinguish from own check-ins
- Engagement scores remain personal (not inflated by household data)

## PCO Campus Integration

### Completed (Phase 1 - Foundation)

**Database:**
- `campuses` table with RLS (org members read, admins manage)
- `campus_id` FK on `contacts` table (nullable, SET NULL on delete)
- Unique constraint on `(organization_id, pco_campus_id)` for safe upserts
- Indexes on `contacts.campus_id` and `campuses.organization_id`

**Edge Function (`pco-sync-processor`):**
- `syncCampuses()` function fetches `/people/v2/campuses` from PCO API
- Called once per org on first chunk (chunk_number === 0)
- Upserts campus data (name, address, city, state, zip)
- `processPersonData()` resolves `primary_campus_id` → local `campus_id` on each contact

**Hook:**
- `useCampuses` hook fetches org campuses for dropdowns/filters

**UI - Contact Profile (`UserProfilePage`):**
- Campus name shown in demographics section via `contacts → campuses` join

**UI - People Page:**
- `ContactsTable`: New "Campus" column (sortable) with MapPin icon
- `ContactFilters`: Campus dropdown filter (All / No Campus / specific campus)
- `useContacts`: Server-side campus filtering via `.eq('campus_id', ...)` or `.is('campus_id', null)`

**UI - Flow Views:**
- `FlowHeaderFilters`: Campus filter buttons (populated from `useCampuses`)
- Campus filter props added (`selectedCampusFilter`, `onCampusFilterChange`)

**UI - ContactDemographics component:**
- Campus badge shown at top of demographics card (Building2 icon)

### Pending (Phase 2)
- Wire `selectedCampusFilter` state in `FlowView.tsx` and filter contacts by campus
- Add campus column to `FlowTableView`
- Show campus label on `ContactCard` in flow board
- Analytics campus filtering (Attendance, People, Overview sections)
- Groups association with campus
- Dashboard `ContactsNeedingAttention` campus context

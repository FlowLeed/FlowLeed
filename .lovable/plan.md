

## PCO Check-Ins Integration: Architecture and Ideas

### What PCO Check-Ins API Provides

The PCO Check-Ins API (`https://api.planningcenteronline.com/check-ins/v2/`) exposes:

- **Events**: Sunday services, special events, classes, VBS, etc.
- **Event Times**: Specific service times (e.g., 9am, 11am)
- **Check-Ins**: Individual check-in records per person per event time
- **Locations**: Rooms/areas (Main Sanctuary, Kids Room, Lobby Serving Station)
- **Person**: Links back to PCO People via `person_id`
- **Attendee types**: Regular, Guest, Volunteer

Each check-in record contains: person_id, event name, event_time, location, kind (Regular/Guest/Volunteer), created_at, checked_out_at.

### Data Model

New table: `pco_checkins`

```text
pco_checkins
├── id (uuid, PK)
├── organization_id (uuid, FK → organizations)
├── contact_id (uuid, FK → contacts, nullable until matched)
├── pc_person_id (text) -- links to PCO person
├── event_name (text) -- "Sunday Service", "VBS", etc.
├── event_time_name (text) -- "9:00 AM", "11:00 AM"
├── location_name (text) -- "Main Room", "Kids Zone"
├── checkin_kind (text) -- 'regular', 'guest', 'volunteer'
├── checked_in_at (timestamptz)
├── checked_out_at (timestamptz, nullable)
├── pco_checkin_id (text, unique) -- dedup key
├── metadata (jsonb) -- raw PCO data
└── created_at (timestamptz)
```

Derived table: `contact_engagement_scores` (materialized via DB function)

```text
contact_engagement_scores
├── contact_id (uuid, PK, FK → contacts)
├── organization_id (uuid)
├── total_checkins_90d (int)
├── total_checkins_30d (int)
├── weeks_attended_last_12 (int)
├── last_checkin_at (timestamptz)
├── engagement_level (text) -- 'highly_engaged', 'active', 'at_risk', 'inactive', 'new'
├── streak_weeks (int) -- consecutive weeks attended
├── volunteer_checkins_90d (int)
├── score (int, 0-100)
└── updated_at (timestamptz)
```

### Edge Function: `pco-sync-checkins`

A dedicated edge function (separate from the people sync) that:

1. Uses the existing PCO OAuth tokens from `integrations` table
2. Fetches from `check-ins/v2/check_ins?include=event_times,locations&filter=regular,guest,volunteer`
3. Supports incremental sync via `updated_at` filter (same pattern as people sync)
4. Matches `pc_person_id` to existing `contacts.pc_person_id` to populate `contact_id`
5. Upserts into `pco_checkins` using `pco_checkin_id` as dedup key
6. Runs on its own schedule (can be triggered manually or via cron, separate from people sync)

Rate limiting protections: same `fetchWithRetry` pattern, 500ms delay between pages, chunked processing.

### Engagement Score Calculation

A DB function `calculate_engagement_scores(org_id)` that runs after each check-in sync:

```text
Score formula (0-100):
├── Attendance frequency (40 pts): weeks attended in last 12 / 12 × 40
├── Recency (25 pts): days since last check-in mapped to 25→0
├── Consistency streak (20 pts): consecutive weeks × 4, max 20
├── Volunteer factor (15 pts): volunteer check-ins in 90d × 3, max 15

Engagement levels:
├── highly_engaged: score >= 75
├── active: score >= 50
├── at_risk: score >= 25
├── inactive: score < 25 AND has history
└── new: < 3 total check-ins ever
```

### How It Surfaces in the UI

**1. Contact Profile Timeline** (`InteractionTimeline.tsx`)
- Check-ins appear as timeline entries alongside calls, texts, flow changes
- Icon: a "check" badge with event name and location
- "Checked in to Sunday Service (9 AM) - Kids Zone" with timestamp

**2. Contact Profile - Engagement Badge**
- New badge on contact profile showing engagement level with color coding
- Highly Engaged (green), Active (blue), At Risk (amber), Inactive (red)
- Hover shows: "Attended 8 of last 12 Sundays, 3-week streak, volunteers regularly"

**3. Dashboard Metrics** (`PersonalMetrics.tsx` or new section)
- "This Week's Attendance" card showing total check-ins across org
- "First-Time Guests" count from check-ins where kind = 'guest'
- "Volunteer Coverage" showing volunteer check-in count

**4. Analytics Page** (`AnalyticsPage.tsx`)
- Attendance trend chart (weekly/monthly)
- Breakdown by event type (services vs events vs kids)
- Engagement level distribution pie chart
- First-time vs returning visitor trends

**5. Flow Integration**
- Engagement score visible on `TaskContactRow` and `ContactCard` in flows
- Filter contacts in flows by engagement level (e.g., show only "at risk" people in Pastoral Care flow)

### Sync Flow

```text
User clicks "Sync Check-Ins" (or cron triggers)
  → pco-sync-checkins edge function
    → Fetch check-ins from PCO API (paginated, incremental)
    → Match pc_person_id → contact_id
    → Upsert into pco_checkins
    → Call calculate_engagement_scores(org_id)
    → Update contact_engagement_scores table
  → UI refreshes with new data
```

### Files to Create/Modify

**New files:**
1. `supabase/functions/pco-sync-checkins/index.ts` -- Edge function for check-in sync
2. `src/hooks/useCheckinData.tsx` -- Hook for fetching check-in data and engagement scores
3. `src/components/contact/EngagementBadge.tsx` -- Engagement level badge component
4. `src/components/analytics/AttendanceSection.tsx` -- Analytics attendance charts

**Modified files:**
1. `src/components/contact/InteractionTimeline.tsx` -- Add check-in entries
2. `src/components/integrations/SyncSettingsSection.tsx` -- Add "Sync Check-Ins" button
3. `src/pages/AnalyticsPage.tsx` -- Add attendance tab/section
4. `src/components/tasks/TaskContactRow.tsx` -- Show engagement badge

**Database migrations:**
1. Create `pco_checkins` table with RLS
2. Create `contact_engagement_scores` table with RLS
3. Create `calculate_engagement_scores` DB function
4. Add unique constraint on `pco_checkins.pco_checkin_id`

### Questions Before Implementation

This is a large feature. I'd recommend building it in phases:
- **Phase 1**: Database tables + edge function + manual sync button
- **Phase 2**: Engagement score calculation + badge on contact profile
- **Phase 3**: Timeline integration + analytics charts
- **Phase 4**: Cron-based auto-sync + flow filters

Want to proceed with Phase 1 first?


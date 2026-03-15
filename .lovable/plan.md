

## Plan: PCO Campus Integration

### Overview
PCO supports multiple campuses (locations/sites). We need to pull campus data during sync and surface it across the app for filtering, grouping, and reporting.

### Data Layer

1. **New `campuses` table** -- stores campus records per organization (synced from PCO)
   - `id`, `organization_id`, `pco_campus_id`, `name`, `address`, `city`, `state`, `is_primary`, `created_at`
   - RLS: org members can read their org's campuses

2. **Add `campus_id` column to `contacts` table** -- FK to `campuses.id`, nullable
   - Populated during PCO sync from `primary_campus_id` on each person

3. **Edge function: `pco-sync-processor`** -- update to:
   - Fetch `/campuses` from PCO API on each sync and upsert into `campuses` table
   - Map each person's `primary_campus_id` to the local `campus_id` when upserting contacts

### Where Campus Shows Up (Surface Areas)

| Location | What to show |
|---|---|
| **Contact Profile** (`ContactDemographics`) | Campus name badge next to address/location info |
| **People Page** (`ContactsTable`) | New "Campus" column (sortable) |
| **People Filters** (`ContactFilters`) | Campus dropdown filter (populated from `campuses` table) |
| **Flow Board** (`FlowHeaderFilters`) | Campus filter in the flow filter popover |
| **Flow Table View** (`FlowTableView`) | Campus column |
| **Contact Cards** (`ContactCard`) | Small campus label beneath name |
| **Analytics - Overview** (`OverviewSection`) | Campus breakdown filter or selector |
| **Analytics - Attendance** (`AttendanceSection`) | Filter check-in stats by campus |
| **Analytics - People** (`PeopleSection`) | Campus distribution chart |
| **Dashboard** (`ContactsNeedingAttention`) | Campus context on contact rows |
| **Groups** (`GroupCard`/`GroupDetailPage`) | Associate groups with a campus |

### Implementation Steps

1. **Migration**: Create `campuses` table + add `campus_id` FK to `contacts` + RLS policies
2. **Sync**: Update `pco-sync-processor` to fetch campuses from PCO API (`/campuses` endpoint) and store `primary_campus_id` mapping on contacts
3. **Hook**: Create `useCampuses` hook to fetch org campuses for dropdowns/filters
4. **Contact Profile**: Show campus badge in `ContactDemographics`
5. **People Page**: Add Campus column to `ContactsTable` + Campus filter to `ContactFilters`
6. **Flow Views**: Add campus filter to `FlowHeaderFilters` and campus column to `FlowTableView`
7. **Analytics**: Add campus filter/selector to Attendance and People sections
8. **Contact Cards**: Show campus label on `ContactCard` in flow board view

### Technical Details

- PCO API endpoint: `GET /people/v2/campuses` returns all campuses with name, address, city, state, zip
- Each person has `primary_campus_id` in their attributes (already logged but not stored)
- The `campuses` table uses a unique constraint on `(organization_id, pco_campus_id)` for safe upserts
- Campus filter will be a simple `Select` dropdown populated by the `useCampuses` hook
- Sorting/filtering on campus will be done at the query level via `.eq('campus_id', selectedCampusId)`


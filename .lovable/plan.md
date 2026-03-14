

## Household Check-ins on Contact Profiles

**Problem**: When a child is checked in at a service, the parent's profile shows no attendance data — even though the parent was clearly present. Currently, check-ins only show for the exact person who was checked in.

**Solution**: Expand the `useContactCheckins` hook to also fetch check-ins from all household members (using the `pc_household_id` on the contacts table). The UI will show both the contact's own check-ins and their household members' check-ins, with a label indicating who was checked in.

### Changes

**1. Update `useContactCheckins` hook** (`src/hooks/useCheckinData.tsx`)
- After fetching the contact's own check-ins, look up the contact's `pc_household_id`
- If a household ID exists, find all other contacts in the same household
- Fetch their check-ins too, tagging each with the household member's name
- Merge, deduplicate by event+date (avoid double-counting if both parent and child checked in at the same event), and sort by date
- Add a `checked_in_by` field to the `CheckinRecord` interface (name of the person who was actually checked in)

**2. Update `ContactCheckinsCard`** (`src/components/contact/ContactCheckinsCard.tsx`)
- Add a "Checked in by" column to the table showing who was actually checked in (e.g., "Emma Smith" for a child's check-in appearing on the parent's profile)
- Use a subtle visual indicator (different badge or lighter text) to distinguish household check-ins from the contact's own check-ins
- Add a label like "Includes household" next to the card title when household data is present

**3. Update `useEngagementScore` hook** — no changes needed here initially. The engagement score stays personal. The household check-ins are informational only (showing the parent was present), not used to inflate their score.

### Technical approach
- Query flow: `contacts.pc_household_id` → find sibling contacts → fetch their `pco_checkins`
- All done client-side with 2-3 additional Supabase queries (lightweight)
- Deduplication: group by `(event_name, checked_in_at date)` — if the contact AND a household member both checked in at the same event on the same day, show it once as the contact's own check-in

### Files changed
- `src/hooks/useCheckinData.tsx` — expand `useContactCheckins` to include household
- `src/components/contact/ContactCheckinsCard.tsx` — show "checked in by" info in the table


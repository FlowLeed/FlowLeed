

## Plan: Show Engagement Levels on the People Page

### What changes

1. **`src/hooks/useContacts.tsx`** — Join `contact_engagement_scores` in the existing contacts query by adding it to the select statement:
   ```
   contact_engagement_scores(score, engagement_level, weeks_attended_last_12, streak_weeks, last_checkin_at, volunteer_checkins_90d)
   ```

2. **`src/components/contacts/ContactsTable.tsx`** — Add an "Engagement" column to the table that displays the `EngagementBadge` component (already built) for each contact. Pull the score from `contact.contact_engagement_scores[0]`. Add sorting support for the engagement score field.

### Technical details

- The `contact_engagement_scores` table has a foreign key to `contacts` via `contact_id`, so Supabase's PostgREST join should work directly.
- Reuse the existing `EngagementBadge` component from `src/components/contact/EngagementBadge.tsx` which already handles all engagement levels with color-coded badges and tooltips.
- The new column will be sortable by numeric score value and placed after the "Phone" column.


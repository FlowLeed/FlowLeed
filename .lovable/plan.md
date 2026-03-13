

## Add Check-in Data to Contact Profile

The contact profile page (`UserProfilePage.tsx`) currently has no check-in information, even though the hooks (`useEngagementScore`, `useContactCheckins`) and the `EngagementBadge` component already exist.

### Changes

**1. Add EngagementBadge to the profile header area**
- Import `useEngagementScore` and `EngagementBadge` into `UserProfilePage.tsx`
- Display the badge next to the contact's name/tags area, showing their engagement level (Highly Engaged, Active, At Risk, etc.)

**2. Create a new `ContactCheckinsCard` component** (`src/components/contact/ContactCheckinsCard.tsx`)
- Uses `useContactCheckins` and `useEngagementScore` hooks
- Shows:
  - **Engagement score** (0-100) with level badge
  - **Key stats row**: check-ins last 30d, last 90d, weeks attended (last 12), streak, last check-in date
  - **Recent check-ins list**: event name, date/time, location, kind (regular/volunteer) — last 10 entries in a compact table/list
- Renders nothing if there's no check-in data (doesn't clutter profiles for orgs without PCO)

**3. Add the card to the profile page**
- Place it after the Flow Moments card and before the AI Suggestions block — a natural spot for attendance data
- Pass `contactId` as the only required prop

### Files Changed
- `src/components/contact/ContactCheckinsCard.tsx` — new component
- `src/pages/UserProfilePage.tsx` — import and render `EngagementBadge` in header + `ContactCheckinsCard` in content area


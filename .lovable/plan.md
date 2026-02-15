

## Fix Leader Selector Search

The search is stuck on "Searching..." because every keystroke triggers a full database re-fetch. The Supabase query fetches all organization members regardless of the search term, and filtering happens client-side -- but `searchTerm` is included in the React Query cache key, causing a new loading state on each keystroke.

### Changes

**File: `src/components/groups/LeaderSelector.tsx`**

1. Remove `searchTerm` from the `queryKey` so the member list is fetched once and cached
2. Move the client-side filtering outside the query function, using `useMemo` to derive filtered results from the cached data
3. This way, typing in the search box instantly filters the already-loaded list without any loading flicker


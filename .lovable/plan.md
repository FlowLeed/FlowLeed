

## Bug: Phone Number Search Fails Due to Special Characters

### Root Cause
Supabase's `.or()` filter uses PostgREST syntax where **parentheses are reserved characters** for grouping logic. When a user searches `(707) 495-1391`, the parentheses in the search term corrupt the filter expression, causing it to fail silently and return no results.

This affects two places:
1. **`src/components/search/GlobalSearch.tsx`** (line 118) — the Cmd+K search
2. **`src/hooks/useContacts.tsx`** (line 148) — the People page search

### Fix

**Sanitize the search input** before passing it into `.or()` by stripping characters that are special in PostgREST syntax (parentheses, commas, periods). For phone searches specifically, also create a digits-only version to match against a normalized phone value.

**Approach**: Strip non-alphanumeric characters from the search term for the phone filter portion, keeping the original for name/email matching. This way `(707) 495-1391`, `707-495-1391`, and `7074951391` all match.

### Changes

1. **`src/hooks/useContacts.tsx`** — Sanitize `filters.searchTerm` before building the `.or()` clause. Create a digits-only version for phone matching.

2. **`src/components/search/GlobalSearch.tsx`** — Same sanitization for the phone portion of the `.or()` filter.

3. Both files: Replace the raw interpolation in `.or()` with a sanitized value that escapes or strips PostgREST-special characters (parentheses, commas).

### Technical Detail

Current broken query:
```
.or(`name.ilike.%(707) 495-1391%,email.ilike.%(707) 495-1391%,phone.ilike.%(707) 495-1391%`)
```

Fixed query approach — strip parens/special chars for the phone filter:
```typescript
const sanitized = searchQuery.replace(/[(),]/g, '');
const digitsOnly = searchQuery.replace(/\D/g, '');
// Use sanitized version in .or() to avoid PostgREST parsing issues
// For phone, match against digits pattern
```




Let me investigate the profile page to understand its mobile responsiveness issues.
<lov-tool-use id="toolu_vrtx_0173z1DonYHapzooXYyGXzy5" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/ProfilePage.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_015WsKdemhGpA2TXR9MwqXMa" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/UserProfilePage.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01LiNUh6M6WVvmfeMRof6W9K" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/ProfilePage.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01346sRSUVcTPpx9EvxFFPHD" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/UserProfilePage.tsx\"}">
</lov-tool-use>
The user is on `/contacts/:contactId` (UserProfilePage) — the contact profile. But the message says "Investigate profile page" — likely the user's own ProfilePage (`/profile`). Let me check the layout/header on mobile for both.
<lov-tool-use id="toolu_vrtx_01YZCJ73R6H49pXheVNxdXRX" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/UserProfilePage.tsx\", \"lines\": \"473-1155\"}">
</lov-tool-use>
I have enough context. The user is on the contact profile page (`UserProfilePage.tsx`) at viewport 390px. Let me check the lower half for layout grid issues quickly.
<lov-tool-use id="toolu_vrtx_012mrVh9D9f9xQLz5xGiX2rk" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/UserProfilePage.tsx\", \"lines\": \"1000-1155\"}">
</lov-tool-use>
I have a clear picture. The user is on the contact profile page (`/contacts/:id`) at 390px viewport. There are also 2 other "profile" pages (`ProfilePage` for "My Profile" and `SuperAdminProfilePage`). Let me clarify scope and present a plan covering both contact profile (current view) and my-profile pages.

<lov-plan>

## Mobile-Friendly Profile Pages Plan

### Scope
The user is on `/contacts/:id` (Contact Profile) at 390px. Three "profile" surfaces need mobile work:
1. **Contact Profile** (`UserProfilePage.tsx`) — currently being viewed
2. **My Profile** (`ProfilePage.tsx`) — user account settings
3. **Super Admin Profile** (`SuperAdminProfilePage.tsx`) — same patterns as My Profile

### Issues found (Contact Profile @ 390px)

**Header card (lines 640-995)**
- Hard-coded `text-3xl` name + Edit button absolute top-right → name overlaps button on small screens
- Phone row has inline Call/Text buttons (`flex items-center gap-2`) — wraps awkwardly, buttons get squished
- Demographics grid is `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` ✓ already responsive
- Avatar column with 4 engagement stat tiles stacked vertically takes ~120px width — fine, but the right column is cramped
- `p-6` on container + `p-6` on card = 48px horizontal padding on a 390px viewport (only 342px usable)
- Tags + "Add" popover row wraps fine but feels tight

**My Profile page**
- All form rows use `grid-cols-2 gap-4` (firstName/lastName, phone/location, jobTitle/department) → too narrow on mobile, inputs become unusable
- Avatar section `flex items-center gap-6` doesn't wrap — button + helper text crammed next to 80px avatar
- `p-6` outer padding is heavy on mobile

### Changes

**1. `src/pages/UserProfilePage.tsx`**
- Outer padding: `p-6` → `p-4 md:p-6`; same for inner card `p-6` → `p-4 md:p-6`
- Header layout: keep flex-col on mobile, make Edit button a normal inline button on mobile (not absolute) OR shrink to icon-only with safe top-right offset (`top-2 right-2`)
- Name `text-3xl` → `text-2xl md:text-3xl` to prevent overflow
- Avatar + stats column: on mobile, switch stats from vertical 1-col to horizontal `grid-cols-4 gap-2` row beneath avatar so the right column gets full width
- Phone row Call/Text buttons: wrap to next line on mobile (`flex-wrap` + `w-full sm:w-auto` on button group)
- Tags row already wraps — verify spacing
- Reassign dialog already `sm:max-w-[425px]` ✓

**2. `src/pages/ProfilePage.tsx` + `SuperAdminProfilePage.tsx`**
- All `grid-cols-2 gap-4` form rows → `grid-cols-1 sm:grid-cols-2 gap-4`
- Avatar section `flex items-center gap-6` → `flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6` with helper text full width on mobile
- Outer `p-6` → `p-4 md:p-6`
- Save button: full-width on mobile (`w-full sm:w-auto`)
- Twilio number badges row: ensure capability badges wrap (`flex-wrap`)

**3. `src/components/profile/SecuritySettings.tsx`**
- Verify single-column layout (already mostly stacked) — make submit buttons `w-full sm:w-auto`

**4. `src/components/profile/NotificationSettings.tsx`**
- Quick check: ensure switch rows don't break (label + switch row should stay aligned)

### What we keep
- All data fetching, state, mutations — untouched
- Desktop layouts identical (changes only add `sm:`/`md:` breakpoints)
- Card structure & visual hierarchy preserved

### Out of scope
- Refactoring the giant `UserProfilePage.tsx` into smaller components (separate task)
- Bottom sheet alternatives for Edit/Reassign dialogs
- Touch gesture improvements

### Visual sketch — Contact Profile @ 390px

```text
Before                          After
+------------------+            +------------------+
| ← Back           |            | ← Back           |
+------------------+            +------------------+
| [Avatar][Name⎮Ed]|            | [Avatar]    [Ed] |
| [stat]   ittxt   |            | Name (2xl)       |
| [stat]  email    |            | tags  ...        |
| [stat]  📞 [Call]|            | [s][s][s][s] row |
| [stat]      [Tx] |            | email            |
+------------------+            | 📞 phone         |
                                | [Call] [Text]    |
                                +------------------+
```


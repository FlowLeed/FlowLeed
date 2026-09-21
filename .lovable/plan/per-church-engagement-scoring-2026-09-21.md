# Per-Church Engagement Scoring

Today every church shares one hard-coded formula. This makes engagement scoring a church-level setting: start from a preset, optionally tune it, choose which activities count, use true consecutive-week streaks, and rename the engagement labels.

## What a church will be able to set

**Presets** (one click, sets everything below):
- Balanced (current behaviour: consistency 35, recency 20, streak 15, serving 20, leadership 10)
- Attendance-focused (consistency and recency carry most of the score)
- Serving-focused (serving and leadership carry more)
- Small-group-focused (group attendance and group membership carry more)
- Custom (whatever they tuned)

**Advanced tuning** (collapsed by default):
- Weight for each ingredient; the page shows the running total and normalises to 100
- Time windows: consistency window (default 12 weeks), recency fade (default 90 days), serving lookback (default 90 days)
- Level cutoffs for Highly Engaged / Active / At Risk / Inactive (default 75 / 50 / 25)
- "New person" rule: fewer than N check-ins ever (default 3)
- Safeguards, each on/off: serving or leading never drops below Active; attended in the last N days (default 14) never At Risk or Inactive
- Household credit on/off: whether a parent gets credit for a child's check-in

**Ingredients they can turn on or off**
- Already counted: service check-ins, group attendance, volunteer/serving check-ins and serving moments, leadership roles
- New options: active group membership, Flow Moments (choose which moment types), notes and interactions logged by the team, form submissions, event attendance, giving (only when a giving source is connected — shown as unavailable otherwise)

**Streaks become real streaks**
- A streak is unbroken weeks with attendance, counted back from the current week
- A church sets how many missed weeks break it (default 1) and whether the current partial week counts
- The "weeks attended out of the window" number stays available and is shown separately, so nothing is lost

**Custom labels**
- Each of the four levels keeps its meaning and colour but can be renamed (e.g. At Risk to "Needs a Call"); renaming updates the badge, contact filters, analytics, and Signals wording

## Where it lives

A new **Engagement** tab inside My Organization settings, next to FlowLeed AI. Owners and admins can change it; Leaders can see it. The tab shows:
1. Preset picker
2. Ingredients list with on/off switches
3. Advanced tuning (collapsed)
4. Labels and cutoffs
5. A live preview: the distribution of people across the four levels under the new settings, plus 10 sample people with their scores, before saving
6. Save and recalculate, with a progress state, and a Reset to preset action

## Behaviour after saving

- Saving recalculates the whole church immediately (background job with a "recalculating" state in the UI, as the Signals freshness indicator already does)
- Every existing consumer keeps working: contact badges and tooltips, contact filters, Flow cards, analytics/Heartbeat, Signals, church health, AI chat and digests — they read the stored score and the church's label names
- Score breakdown becomes visible: the badge tooltip and the contact profile show each ingredient's contribution ("Consistency 26 of 35, Serving 8 of 20"), so the number is explainable
- Churches that never open the tab keep exactly today's results

## Technical details

Database:
- New `org_engagement_settings` (one row per organization): preset key, jsonb `weights`, jsonb `windows`, jsonb `thresholds`, jsonb `ingredients`, jsonb `labels`, jsonb `safeguards`, updated_by, timestamps. Grants to `authenticated` and `service_role`; RLS: org members read, owners/admins write.
- Add `score_breakdown jsonb`, `consecutive_streak_weeks int` to `contact_engagement_scores`; keep `streak_weeks` as the weeks-in-window count.
- Rewrite `calculate_engagement_scores(p_org_id)` to load the org's settings (falling back to the Balanced defaults when no row exists) and drive all weights, windows, cutoffs, ingredient inclusion, streak rule, and safeguards from that jsonb instead of literals. Keep the existing household/family check-in CTEs behind the household-credit flag. Compute the consecutive streak with a gap-aware window function over weekly attendance.
- Add `preview_engagement_settings(p_org_id, p_settings jsonb)` — a read-only security-definer function returning the level distribution and a sample of scored people, for the preview panel without writing rows.
- Keep the post-sync and daily recalculation call sites unchanged (`pco-sync-checkins`, `pco-sync-group-attendance`, `pco-checkin-auto-sync`, cron).

Frontend:
- `src/lib/engagementSettings.ts`: preset definitions, ingredient registry (key, label, description, required integration), defaults, and a zod-validated settings type shared by the settings UI and the preview.
- `src/hooks/useEngagementSettings.tsx`: read/update settings, trigger recalculation, expose recalculating state.
- `src/pages/settings/EngagementSettingsPage.tsx` exported as `EngagementSettingsContent`, mounted as an `engagement` tab in `src/pages/TeamPage.tsx`.
- `EngagementBadge.tsx` and the contact profile read labels from settings and render the breakdown; `ContactFilters.tsx`, analytics sections, and `useContacts` use the custom label names while still filtering on the stored level keys.

## Delivery order

1. Settings table, defaults, and the Engagement tab with presets and labels (scoring still behaves as today).
2. Rewrite the scoring function to read settings; add breakdown and consecutive streak.
3. Advanced tuning, ingredient switches, and the live preview.
4. Custom labels and breakdown display across badges, filters, analytics, and Signals.

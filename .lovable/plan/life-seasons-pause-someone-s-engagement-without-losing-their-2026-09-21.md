# Life Seasons: pause someone's engagement without losing their history

When a person tells the church they are sick, welcoming a baby, deployed, travelling or grieving, the team can mark a **Life Season**. Their engagement score is frozen where it was, their profile shows a clear notice, and they stop showing up in "needs attention" lists until the season ends.

## What the team sees

**On a person's profile**
- A "Pause engagement" action next to their engagement badge.
- Choose a reason: Sick / Medical, New baby, Deployed, Travelling / away, Bereavement, Other (with a short note).
- Seasons are open-ended. No end date is required.
- While paused, the profile shows a banner such as "Paused — New baby since Mar 4, noted by Alex" with "End season" and "Edit" actions.
- Their engagement badge shows the frozen score with a small pause mark and a tooltip: "Score held since Mar 4 (New baby)."

**Anyone on the team can start, edit or end a season**, and every change is recorded with who did it and when.

**Reminders**
- Since seasons have no end date, the app sends the person who set it a reminder every 30 days: "Is Sarah still away? Her engagement score has been paused for 30 days." The reminder links to the profile with "Still paused" and "End season" actions.
- Choosing "Still paused" restarts the 30-day clock, so nobody is nagged weekly.

**Where paused people are hidden**
- Signals and attention lists (stopped attending, at-risk style Signals and custom Signals) skip paused people; each list shows a small line: "3 paused people not shown."
- The daily assignment digest email leaves paused people out.
- They stay fully visible in People, Flows, groups and search — pausing is not hiding.

**A Paused filter** is added to the People filters and Flow filters so leaders can pull up everyone currently in a season and see who to check on.

## How the frozen score works

When a season starts, the person's current score, level and point breakdown are saved with the season. From then on, nightly recalculation skips them and keeps showing the saved score and level. When the season ends, normal scoring resumes on the next recalculation, using their real recent activity — nothing is back-filled or faked.

If someone starts attending again while still marked paused, their next attendance automatically ends the season and a note is added to the profile ("Season ended automatically — attended Apr 12"), so records don't stay stale.

## Technical details

- New table `contact_life_seasons`: organization_id, contact_id, reason (enum-style text), note, started_on, ended_on (null while active), frozen_score, frozen_level, frozen_breakdown jsonb, created_by_user_id, ended_by_user_id, last_reminded_at, timestamps. Explicit grants to authenticated and service_role; RLS scoped to the contact's organization (any org member may insert/update/end; reads limited to org members). A partial unique index keeps at most one active season per contact.
- `compute_engagement_rows` / `calculate_engagement_scores` join active seasons: paused contacts return their frozen score, level and breakdown instead of a fresh computation, with a `paused` flag in the breakdown. `preview_engagement_settings` respects the same rule so previews match reality.
- Signal evaluation (`recompute_contact_markers`, `evaluate-custom-signals`) and the daily digest exclude contacts with an active season; excluded counts are returned for the "not shown" line.
- A trigger on new service check-ins / group attendance ends an active season and writes a contact note.
- Reminders reuse the existing notifications table plus a daily pg_cron job (runs once a day alongside the current digest schedule) that creates a reminder when `last_reminded_at` is older than 30 days; the job only touches active seasons, so it is cheap.
- Frontend: `useLifeSeason` hook, `LifeSeasonBanner` and `PauseEngagementDialog` on the contact profile, pause mark in `EngagementBadge`, "Paused" option in `ContactFilters` and `FlowHeaderFilters`, and an "Engagement pauses" summary line in the Engagement settings tab showing how many people are currently paused.

## Order of work

1. Table, policies and the frozen-score changes in the scoring functions.
2. Profile banner, pause/edit/end dialog, badge pause mark.
3. Signal, attention-list and digest exclusions with the "not shown" counts.
4. People and Flow "Paused" filters.
5. 30-day reminders and automatic end on renewed attendance.

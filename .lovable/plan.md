# Separate group-attendance engagement score

## What will change
- Give **Group attendance** its own adjustable point value instead of combining it with service attendance.
- Score it by **recent attendance**: full points for a recent group attendance, then gradually reduce the points to zero across the church’s configured activity window.
- Show the Group attendance points separately in each person’s engagement score breakdown and in Preview.

## Settings behavior
- The Group attendance card gets its own “How much it matters” slider.
- Existing churches keep their current results until an owner saves and updates scores; the new default group-attendance weight starts at zero to avoid unexpectedly changing scores.
- The Small-group-focused starting point assigns meaningful points to both recent group attendance and active group membership.
- Service consistency, service recency, and service streak use service check-ins only, so group attendance is not counted twice.

## Technical details
- Extend engagement settings with a `group_attendance` weight while preserving older saved settings.
- Update the scoring function to calculate the latest recorded group attendance separately, apply recency decay, include it in the normalized 100-point score, and expose it in the stored breakdown.
- Keep score previews, saved recalculations, Life Season freezes, and existing sync-triggered updates on the same scoring path.
- Verify the settings compile and the preview function returns the new breakdown without changing saved scores automatically.

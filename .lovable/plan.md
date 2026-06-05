## Problem

Clicking **Recompute** on the Signals page errors with:
> column ga.meeting_id does not exist

The `public.recompute_contact_markers(p_org_id)` function joins `group_attendance ga` using `ga.meeting_id`, but the actual column on `group_attendance` is `group_meeting_id`.

## Fix

Create a migration that replaces `public.recompute_contact_markers` with the same body, changing the one join condition:

```sql
LEFT JOIN group_attendance ga
  ON ga.group_member_id = gmr.gm_id
 AND ga.group_meeting_id = rgm.meeting_id   -- was ga.meeting_id
```

No other code, table, or frontend changes are needed. After the migration runs, the Recompute button on `/signals` will succeed and populate `contact_markers`.

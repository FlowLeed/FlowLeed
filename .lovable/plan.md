# Org Members Activity Panel (Super Admin)

Add a new section on `/fl-admin/organizations/:id` that lists every user in the organization with their role, last login, recent login activity, and engagement signals.

## Where it goes
- File: `src/pages/admin/OrganizationDetailPage.tsx`
- New section below the existing "Phone Numbers" card: **"Team Members"**.
- New component: `src/components/admin/OrgMembersTable.tsx`.
- New hook: `src/hooks/useOrgMembersActivity.tsx`.

## What we show (one row per user)

| Column | Source |
|---|---|
| Name + email + avatar | `profiles` joined on `organization_members.user_id` |
| Role | `organization_members.role` (Owner/Admin/Leader using existing terminology) |
| Joined | `organization_members.created_at` |
| Last login | `MAX(user_logins.logged_in_at)` for that user+org |
| Logins (30d) | `COUNT(user_logins)` where `logged_in_at > now() - 30d` |
| Logins (7d) | same, 7-day window |
| Contacts assigned | `COUNT(contacts WHERE assigned_to_user_id = user)` |
| Notes (30d) | `COUNT(contact_notes WHERE created_by_user_id = user AND created_at > now() - 30d)` |
| Interactions (30d) | `COUNT(contact_interactions WHERE created_by_user_id = user AND created_at > now() - 30d)` |
| Engagement | Computed badge: Active / Light / Dormant (see rules below) |

Engagement badge rules (client-side from the above counts):
- **Active** — login in last 7d AND (notes+interactions in 30d ≥ 5)
- **Light** — login in last 30d
- **Dormant** — no login in 30d

## Data fetching

One RPC keeps the page fast and avoids N+1. Add migration:

```sql
create or replace function public.admin_get_org_members_activity(p_org_id uuid)
returns table (
  user_id uuid, role text, joined_at timestamptz,
  full_name text, email text, avatar_url text,
  last_login timestamptz, logins_30d int, logins_7d int,
  contacts_assigned int, notes_30d int, interactions_30d int
)
language sql stable security definer set search_path = public as $$
  select
    om.user_id, om.role, om.created_at as joined_at,
    p.full_name, p.email, p.avatar_url,
    (select max(logged_in_at) from user_logins ul
       where ul.user_id = om.user_id and ul.organization_id = p_org_id) as last_login,
    (select count(*)::int from user_logins ul
       where ul.user_id = om.user_id and ul.organization_id = p_org_id
       and ul.logged_in_at > now() - interval '30 days') as logins_30d,
    (select count(*)::int from user_logins ul
       where ul.user_id = om.user_id and ul.organization_id = p_org_id
       and ul.logged_in_at > now() - interval '7 days') as logins_7d,
    (select count(*)::int from contacts c
       where c.organization_id = p_org_id and c.assigned_to_user_id = om.user_id) as contacts_assigned,
    (select count(*)::int from contact_notes n
       join contacts c on c.id = n.contact_id
       where c.organization_id = p_org_id and n.created_by_user_id = om.user_id
       and n.created_at > now() - interval '30 days') as notes_30d,
    (select count(*)::int from contact_interactions i
       join contacts c on c.id = i.contact_id
       where c.organization_id = p_org_id and i.created_by_user_id = om.user_id
       and i.created_at > now() - interval '30 days') as interactions_30d
  from organization_members om
  left join profiles p on p.user_id = om.user_id
  where om.organization_id = p_org_id
  order by last_login desc nulls last;
$$;

revoke all on function public.admin_get_org_members_activity(uuid) from public;
grant execute on function public.admin_get_org_members_activity(uuid) to authenticated;
```

Authorization: the function is `SECURITY DEFINER` but called via a hook that's only reachable from the Super Admin layout (already protected by `SuperAdminProtectedRoute`). We additionally gate inside the function:

```sql
-- prepend body with:
if not public.is_system_admin(auth.uid()) then
  raise exception 'forbidden';
end if;
```

(`is_system_admin` already exists per current RLS usage.)

## UI
- Card titled **Team Members** with member count subtitle.
- Sortable shadcn `Table`; default sort = Last login desc.
- Empty/loading skeleton rows.
- Click row → existing impersonation dialog pre-filled with that user (reuse `StartImpersonationDialog`).
- Use existing role terminology (`member` → "Leader") from project memory.

## Out of scope
- Editing roles, removing members (separate flow).
- Per-user historical charts.

## Risks / notes
- `user_logins` may not have rows for users who logged in before tracking was added → those show "Never". Acceptable.
- Counts run per-user via subqueries; fine for orgs <500 members. If perf becomes an issue, switch to aggregations with `GROUP BY`.

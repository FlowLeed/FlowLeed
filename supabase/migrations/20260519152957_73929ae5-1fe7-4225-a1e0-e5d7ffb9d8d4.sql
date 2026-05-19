create or replace function public.admin_get_org_members_activity(p_org_id uuid)
returns table (
  user_id uuid, role text, joined_at timestamptz,
  full_name text, email text, avatar_url text,
  last_login timestamptz, logins_30d int, logins_7d int,
  contacts_assigned int, notes_30d int, interactions_30d int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_system_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;
  return query
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
end;
$$;

revoke all on function public.admin_get_org_members_activity(uuid) from public;
grant execute on function public.admin_get_org_members_activity(uuid) to authenticated;
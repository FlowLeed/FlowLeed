-- Insert the first user as super_admin if no super_admin exists yet
INSERT INTO public.system_user_roles (user_id, role, notes, granted_by)
SELECT 
  p.user_id,
  'super_admin'::system_role,
  'Initial super admin - automatically granted to first user',
  p.user_id
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_user_roles WHERE role = 'super_admin'
)
ORDER BY p.created_at ASC
LIMIT 1;
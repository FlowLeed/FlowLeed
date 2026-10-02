REVOKE ALL ON FUNCTION public.auto_clear_demo_on_real_contact() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_demo_data_for_org(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preview_engagement_settings(uuid, jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_engagement_settings(uuid, jsonb, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_engagement_settings(uuid, jsonb, integer) TO authenticated;
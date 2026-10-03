CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    -- send-push loads the notification itself, so only its id is sent. The helper reads
    -- project_url and cron_secret from Vault, and send-push checks the cron secret.
    PERFORM private.invoke_edge_function('send-push', jsonb_build_object('notification_id', NEW.id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push dispatch failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_push_on_notification() FROM PUBLIC, anon, authenticated;
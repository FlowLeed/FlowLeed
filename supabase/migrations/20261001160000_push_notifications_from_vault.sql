-- notify_push_on_notification() sends a browser push through the send-push Edge Function each time
-- a row is inserted into public.notifications. It had production's URL written into it and
-- authenticated with the service-role key from Vault, so every environment pushed through
-- production. send-push itself accepted any JWT for the project, including the public anon key.
--
-- It now calls send-push through private.invoke_edge_function(), which reads project_url and
-- cron_secret from Vault and sends the secret in the x-cron-secret header that send-push checks.
-- The service_role_key Vault secret is no longer used.
--
-- A push that can't be sent, for example because those Vault secrets are missing, is logged as a
-- warning and never stops the notification from being saved.

CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  BEGIN
    PERFORM private.invoke_edge_function('send-push', jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', NEW.message,
      'url', CASE
        WHEN NEW.contact_id IS NOT NULL AND NEW.pipeline_id IS NOT NULL
          THEN '/contacts/' || NEW.contact_id || '?pipelineId=' || NEW.pipeline_id
        WHEN NEW.contact_id IS NOT NULL THEN '/contacts/' || NEW.contact_id
        WHEN NEW.pipeline_id IS NOT NULL THEN '/flows/' || NEW.pipeline_id
        ELSE '/'
      END,
      'tag', NEW.id::text,
      'notification_id', NEW.id
    ));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Push for notification % not sent: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

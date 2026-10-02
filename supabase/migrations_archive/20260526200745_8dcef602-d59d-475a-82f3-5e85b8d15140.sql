
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own push subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- Trigger: when a notification row is inserted, fire the send-push edge function via pg_net
CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_url TEXT := 'https://lghamvpolwebtjwaxned.supabase.co';
  v_service_key TEXT;
  v_url TEXT;
BEGIN
  -- Service role key is stored in vault.secrets (Supabase managed). Fallback: skip.
  BEGIN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  IF v_service_key IS NULL THEN
    RETURN NEW;
  END IF;

  v_url := v_project_url || '/functions/v1/send-push';

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
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
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_on_notification ON public.notifications;
CREATE TRIGGER trg_notify_push_on_notification
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_notification();

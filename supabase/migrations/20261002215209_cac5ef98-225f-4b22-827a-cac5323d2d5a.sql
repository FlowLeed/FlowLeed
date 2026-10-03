ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_notified_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_tasks_due_pending ON public.tasks (due_at) WHERE completed_at IS NULL AND due_notified_at IS NULL AND due_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_due_tasks()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  WITH due AS (
    UPDATE public.tasks t SET due_notified_at = now()
    WHERE t.completed_at IS NULL AND t.due_notified_at IS NULL AND t.due_at IS NOT NULL
      AND t.due_at <= now() AND t.due_at > now() - interval '24 hours'
      AND t.assigned_to_user_id IS NOT NULL
    RETURNING t.id, t.title, t.description, t.contact_id, t.assigned_to_user_id, t.organization_id
  ), ins AS (
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, contact_id, metadata)
    SELECT d.assigned_to_user_id, d.organization_id, 'task_due',
      'Task due · ' || left(d.title, 100),
      COALESCE(NULLIF(left(d.description, 140), ''), CASE WHEN c.name IS NOT NULL THEN 'For ' || c.name ELSE 'Open Tasks to check it off.' END),
      d.contact_id, jsonb_build_object('task_id', d.id)
    FROM due d LEFT JOIN public.contacts c ON c.id = d.contact_id
    RETURNING 1
  )
  SELECT count(*) INTO n FROM ins;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_due_tasks() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_due_reminder_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN NEW.due_notified_at := NULL; END IF;
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    UPDATE public.notifications SET read = true, read_at = now()
    WHERE type = 'task_due' AND read = false AND metadata->>'task_id' = NEW.id::text;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tasks_due_reminder_sync() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_tasks_due_reminder_sync ON public.tasks;
CREATE TRIGGER trg_tasks_due_reminder_sync BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tasks_due_reminder_sync();

-- Turn due tasks into notifications (and pushes) every minute, as in production. Plain SQL: no URL or key.
SELECT cron.schedule('notify-due-tasks', '* * * * *', $$SELECT public.notify_due_tasks()$$);

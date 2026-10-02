ALTER TABLE public.group_settings
  ADD COLUMN IF NOT EXISTS signup_confirmation_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS signup_confirmation_subject text,
  ADD COLUMN IF NOT EXISTS signup_confirmation_body text,
  ADD COLUMN IF NOT EXISTS leader_notification_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS leader_notification_subject text,
  ADD COLUMN IF NOT EXISTS leader_notification_body text,
  ADD COLUMN IF NOT EXISTS communication_reply_to text;
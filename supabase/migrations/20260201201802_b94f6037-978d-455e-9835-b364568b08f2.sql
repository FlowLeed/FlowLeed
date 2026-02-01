-- Add notification preferences to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb 
DEFAULT '{"email_digest_enabled": true}'::jsonb;

-- Add tracking columns to notifications table for email digest
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS email_digest_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email_digest_sent_at timestamptz;

-- Add index for efficient querying of unsent digest notifications
CREATE INDEX IF NOT EXISTS idx_notifications_email_digest_pending 
ON public.notifications (user_id, email_digest_sent) 
WHERE email_digest_sent = false;
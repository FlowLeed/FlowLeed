-- Manually confirm email for test user molodist+16@gmail.com
-- This is a one-time fix for the user affected by the bug

UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'molodist+16@gmail.com'
  AND email_confirmed_at IS NULL;
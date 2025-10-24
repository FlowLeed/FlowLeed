-- Add use_twilio_integration preference to profiles
ALTER TABLE profiles 
ADD COLUMN use_twilio_integration BOOLEAN DEFAULT true;

COMMENT ON COLUMN profiles.use_twilio_integration IS 
'When true, use Twilio for calls/SMS. When false, use native device actions (tel:/sms:)';
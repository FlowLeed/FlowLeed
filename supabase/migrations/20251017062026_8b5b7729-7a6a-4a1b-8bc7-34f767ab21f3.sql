-- Add fields for FL-Admin onboarding stage tracking
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS onboarding_stage_entered_at timestamptz,
ADD COLUMN IF NOT EXISTS fl_admin_assigned_to uuid REFERENCES profiles(user_id),
ADD COLUMN IF NOT EXISTS fl_admin_notes text;

-- Update existing records to set stage entered date based on created_at
UPDATE organizations 
SET onboarding_stage_entered_at = created_at 
WHERE onboarding_stage_entered_at IS NULL;
-- Add onboarding fields to profiles table for team member onboarding
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_progress JSONB DEFAULT '{"profile_completed": false, "flows_reviewed": false, "first_interaction": false}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_dismissed BOOLEAN DEFAULT false;

-- Create index for quick onboarding queries
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed ON profiles(onboarding_completed);

-- Update organizations onboarding_progress structure for consistency
-- Set default structure for existing records with null onboarding_progress
UPDATE organizations 
SET onboarding_progress = '{
  "first_flow_created": false,
  "pco_connected": false,
  "pco_lists_mapped": false,
  "team_members_invited": false,
  "flow_owners_assigned": false
}'::jsonb
WHERE onboarding_progress IS NULL;
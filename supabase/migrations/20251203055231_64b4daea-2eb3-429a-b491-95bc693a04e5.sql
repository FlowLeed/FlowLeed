-- Drop the existing check constraint
ALTER TABLE flow_moments DROP CONSTRAINT IF EXISTS flow_moments_source_system_check;

-- Add a new check constraint that includes 'flow' as a valid source_system
ALTER TABLE flow_moments 
ADD CONSTRAINT flow_moments_source_system_check 
CHECK (source_system IN ('pco', 'manual', 'form', 'flow'));
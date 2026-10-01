-- Add flow_type and cycle_days to pipelines table
ALTER TABLE pipelines 
ADD COLUMN flow_type TEXT NOT NULL DEFAULT 'linear' CHECK (flow_type IN ('linear', 'recurring')),
ADD COLUMN cycle_days INTEGER CHECK (cycle_days IS NULL OR cycle_days > 0);

-- Add comment for clarity
COMMENT ON COLUMN pipelines.flow_type IS 'Type of flow: linear (one-time completion) or recurring (cycles back to start)';
COMMENT ON COLUMN pipelines.cycle_days IS 'Days before cycling back to start step (only for recurring flows)';
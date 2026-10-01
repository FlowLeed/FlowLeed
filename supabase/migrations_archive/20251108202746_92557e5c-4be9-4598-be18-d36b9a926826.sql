-- Add metadata column to integrations table for storing error messages and other metadata
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
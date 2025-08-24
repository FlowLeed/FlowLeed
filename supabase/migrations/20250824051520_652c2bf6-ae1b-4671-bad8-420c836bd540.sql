-- Add sync_frequency field to integrations table
ALTER TABLE public.integrations 
ADD COLUMN sync_frequency text DEFAULT 'every_15_minutes';

-- Add check constraint for valid frequency values
ALTER TABLE public.integrations 
ADD CONSTRAINT valid_sync_frequency 
CHECK (sync_frequency IN (
  'every_5_minutes', 
  'every_15_minutes', 
  'every_30_minutes', 
  'hourly', 
  'daily', 
  'weekly', 
  'manual'
));
-- Add auto_sync_all_people column to integrations table
-- Default to true so existing PCO integrations start syncing automatically
ALTER TABLE public.integrations 
ADD COLUMN IF NOT EXISTS auto_sync_all_people boolean DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.integrations.auto_sync_all_people IS 'When enabled, automatically syncs all people from Planning Center based on sync_frequency';
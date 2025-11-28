-- Create debug log table for PCO sync investigations
CREATE TABLE IF NOT EXISTS pco_sync_debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pc_person_id TEXT UNIQUE NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  field_data_count INTEGER,
  field_ids_returned TEXT[],
  raw_response JSONB,
  checked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies
ALTER TABLE pco_sync_debug_logs ENABLE ROW LEVEL SECURITY;

-- System admins can view debug logs
CREATE POLICY "System admins can view debug logs"
  ON pco_sync_debug_logs
  FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

-- System can insert debug logs
CREATE POLICY "System can insert debug logs"
  ON pco_sync_debug_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pco_sync_debug_logs_pc_person_id 
  ON pco_sync_debug_logs(pc_person_id);

CREATE INDEX IF NOT EXISTS idx_pco_sync_debug_logs_contact_id 
  ON pco_sync_debug_logs(contact_id);

CREATE INDEX IF NOT EXISTS idx_pco_sync_debug_logs_checked_at 
  ON pco_sync_debug_logs(checked_at DESC);
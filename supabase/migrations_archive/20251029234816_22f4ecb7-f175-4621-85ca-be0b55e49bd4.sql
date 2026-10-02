-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create pco_sync_jobs table to track overall sync jobs
CREATE TABLE IF NOT EXISTS public.pco_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  list_mapping_id UUID NOT NULL REFERENCES public.integration_list_mappings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_contacts INTEGER NOT NULL DEFAULT 0,
  processed_contacts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create pco_sync_queue table to store chunks of contacts
CREATE TABLE IF NOT EXISTS public.pco_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id UUID NOT NULL REFERENCES public.pco_sync_jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
  chunk_data JSONB NOT NULL,
  chunk_number INTEGER NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_pco_sync_jobs_org ON public.pco_sync_jobs(organization_id);
CREATE INDEX idx_pco_sync_jobs_status ON public.pco_sync_jobs(status);
CREATE INDEX idx_pco_sync_queue_job ON public.pco_sync_queue(sync_job_id);
CREATE INDEX idx_pco_sync_queue_status ON public.pco_sync_queue(status);
CREATE INDEX idx_pco_sync_queue_pending ON public.pco_sync_queue(created_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.pco_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pco_sync_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pco_sync_jobs
CREATE POLICY "Users can view sync jobs for their organization"
  ON public.pco_sync_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = pco_sync_jobs.organization_id
        AND user_id = auth.uid()
    )
  );

-- RLS Policies for pco_sync_queue
CREATE POLICY "Users can view queue items for their organization"
  ON public.pco_sync_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pco_sync_jobs
      JOIN public.organization_members ON organization_members.organization_id = pco_sync_jobs.organization_id
      WHERE pco_sync_jobs.id = pco_sync_queue.sync_job_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pco_sync_jobs_updated_at
  BEFORE UPDATE ON public.pco_sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sync_updated_at();

CREATE TRIGGER update_pco_sync_queue_updated_at
  BEFORE UPDATE ON public.pco_sync_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sync_updated_at();

-- Setup cron job to process queue every minute
SELECT cron.schedule(
  'pco-sync-processor',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lghamvpolwebtjwaxned.supabase.co/functions/v1/pco-sync-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnaGFtdnBvbHdlYnRqd2F4bmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MjE0OTEsImV4cCI6MjA3MTQ5NzQ5MX0.yrtGMayjKCu0-K41XWanNe7U3zM0z39cK1fy1OgN7E4"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
-- Make list_mapping_id nullable in pco_sync_jobs to support full people sync
ALTER TABLE public.pco_sync_jobs 
ALTER COLUMN list_mapping_id DROP NOT NULL;

-- Drop the foreign key constraint and recreate it without NOT NULL requirement
ALTER TABLE public.pco_sync_jobs 
DROP CONSTRAINT IF EXISTS pco_sync_jobs_list_mapping_id_fkey;

-- Recreate the foreign key allowing NULLs (which it does by default)
ALTER TABLE public.pco_sync_jobs 
ADD CONSTRAINT pco_sync_jobs_list_mapping_id_fkey 
FOREIGN KEY (list_mapping_id) 
REFERENCES public.integration_list_mappings(id) 
ON DELETE CASCADE;
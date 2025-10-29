-- Fix Planning Center sync by replacing partial index with proper unique constraint
-- This allows .upsert() to work correctly with onConflict

-- First, check for any duplicate PC contacts (shouldn't be any, but let's be safe)
-- This is informational only and won't block the migration
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT pc_person_id, organization_id, COUNT(*) as cnt
    FROM contacts 
    WHERE pc_person_id IS NOT NULL
    GROUP BY pc_person_id, organization_id 
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE WARNING 'Found % duplicate PC person records. These will need to be manually resolved.', duplicate_count;
  END IF;
END $$;

-- Drop the problematic partial index
-- Partial indexes don't work with PostgreSQL's ON CONFLICT clause
DROP INDEX IF EXISTS public.contacts_pc_person_org_unique;

-- Add a proper unique constraint
-- Note: This will naturally allow multiple rows with NULL pc_person_id (manual contacts)
-- because NULL != NULL in SQL, so each NULL is considered unique
ALTER TABLE public.contacts
ADD CONSTRAINT contacts_pc_person_org_unique 
UNIQUE (pc_person_id, organization_id);

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'Successfully replaced partial index with unique constraint on contacts table';
END $$;
-- Add gender column to contact_demographics table
ALTER TABLE public.contact_demographics 
ADD COLUMN gender text;
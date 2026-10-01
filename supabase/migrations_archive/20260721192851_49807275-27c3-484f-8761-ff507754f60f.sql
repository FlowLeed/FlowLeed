UPDATE public.content_videos
SET title = regexp_replace(title, '(''s)?\s+Baptism\s*$', '''s Story')
WHERE organization_id = '5a730e55-ae24-496d-b3b9-6cfdda00ee04'
  AND title ~* '\sBaptism\s*$';
-- Add missing stages to Host Team Launch pipeline
INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order) VALUES
  ('d1af561c-760a-4537-ac8b-82a928bbd3b0', 'Interest', '#3b82f6', 0),
  ('d1af561c-760a-4537-ac8b-82a928bbd3b0', 'Interview', '#eab308', 1),
  ('d1af561c-760a-4537-ac8b-82a928bbd3b0', 'Orientation', '#22c55e', 2),
  ('d1af561c-760a-4537-ac8b-82a928bbd3b0', '1st Month Serving', '#a855f7', 3);
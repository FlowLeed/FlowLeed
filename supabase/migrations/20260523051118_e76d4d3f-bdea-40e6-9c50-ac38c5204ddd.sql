-- Remove the 57 contacts mistakenly bulk-added to Alex's Personal Flow on 2026-05-20 22:38:05
-- and clean up matching history entries so they don't appear on contact profiles.

DELETE FROM contact_interactions
WHERE pipeline_id = '19890628-b864-43d2-875a-91ac2077d604'
  AND created_at = '2026-05-20 22:38:05.891671+00';

DELETE FROM pipeline_contacts
WHERE pipeline_id = '19890628-b864-43d2-875a-91ac2077d604'
  AND created_at = '2026-05-20 22:38:05.891671+00';
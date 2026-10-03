-- Called through the Vault helper (project_url + cron_secret); care-agent-run checks the cron secret.
SELECT cron.schedule('care-agent-daily', '0 12,13,14 * * *',
  $$SELECT private.invoke_edge_function('care-agent-run', '{"source": "cron"}'::jsonb)$$);
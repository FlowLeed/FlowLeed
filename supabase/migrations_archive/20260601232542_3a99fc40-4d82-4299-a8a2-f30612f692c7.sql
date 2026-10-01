-- Reschedule pco-user-permissions-daily with x-cron-secret header from Vault
DO $$
DECLARE
  v_secret text;
  v_jobid bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'pco_cron_secret'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'pco_cron_secret not found in vault. Run: SELECT vault.create_secret(''<value>'', ''pco_cron_secret'');';
  END IF;

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'pco-user-permissions-daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule('pco-user-permissions-daily');
  END IF;

  PERFORM cron.schedule(
    'pco-user-permissions-daily',
    '0 4 * * *',
    format($cmd$
      SELECT net.http_post(
        url := 'https://lghamvpolwebtjwaxned.supabase.co/functions/v1/pco-sync-user-permissions-cron',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb
      );
    $cmd$, v_secret)
  );
END $$;
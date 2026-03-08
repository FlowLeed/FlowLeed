import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[checkin-auto-sync] Starting cron check-in sync...');

    // Find all active PCO integrations that have auto_sync_all_people enabled
    const { data: integrations, error: intError } = await supabase
      .from('integrations')
      .select('id, organization_id, metadata, sync_frequency')
      .eq('service_name', 'planning_center')
      .eq('status', 'active')
      .eq('auto_sync_all_people', true);

    if (intError) {
      console.error('[checkin-auto-sync] Error fetching integrations:', intError.message);
      throw intError;
    }

    if (!integrations || integrations.length === 0) {
      console.log('[checkin-auto-sync] No active integrations with auto-sync enabled');
      return new Response(JSON.stringify({ message: 'No integrations to sync', synced: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[checkin-auto-sync] Found ${integrations.length} integrations to check`);

    const now = new Date();
    let triggeredCount = 0;

    for (const integration of integrations) {
      const metadata = (integration.metadata as any) || {};
      const lastCheckinSync = metadata.last_checkin_sync_at;
      const frequency = integration.sync_frequency || 'daily';

      // Determine if sync is due based on frequency
      let shouldSync = false;
      if (!lastCheckinSync) {
        shouldSync = true; // Never synced before
      } else {
        const lastSync = new Date(lastCheckinSync);
        const hoursSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);

        if (frequency === 'daily' && hoursSinceLastSync >= 24) {
          shouldSync = true;
        } else if (frequency === 'twice_daily' && hoursSinceLastSync >= 12) {
          shouldSync = true;
        }
        // 'manual' frequency never auto-syncs
      }

      if (!shouldSync) {
        console.log(`[checkin-auto-sync] Skipping org ${integration.organization_id} (last sync: ${lastCheckinSync}, freq: ${frequency})`);
        continue;
      }

      console.log(`[checkin-auto-sync] Triggering check-in sync for org ${integration.organization_id}`);

      // Invoke the pco-sync-checkins function
      try {
        const { error: invokeError } = await supabase.functions.invoke('pco-sync-checkins', {
          body: { integrationId: integration.id },
        });

        if (invokeError) {
          console.error(`[checkin-auto-sync] Error invoking sync for org ${integration.organization_id}:`, invokeError.message);
        } else {
          triggeredCount++;
          console.log(`[checkin-auto-sync] Successfully triggered sync for org ${integration.organization_id}`);
        }
      } catch (err) {
        console.error(`[checkin-auto-sync] Failed to trigger sync for org ${integration.organization_id}:`, err);
      }
    }

    console.log(`[checkin-auto-sync] Done. Triggered ${triggeredCount} of ${integrations.length} integrations`);

    return new Response(JSON.stringify({
      success: true,
      checked: integrations.length,
      triggered: triggeredCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[checkin-auto-sync] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

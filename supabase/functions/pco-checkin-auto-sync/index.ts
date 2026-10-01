import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_ROUNDS = 10;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[checkin-auto-sync] Starting cron check-in sync...');

    // Find all active PCO integrations with auto-sync enabled
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

      // Skip if a sync is already in progress (cursor exists)
      if (metadata.checkin_sync_cursor) {
        // Check if it's stale (>2 hours old)
        const startedAt = metadata.checkin_sync_started_at;
        if (startedAt && (now.getTime() - new Date(startedAt).getTime()) > 2 * 60 * 60 * 1000) {
          console.log(`[checkin-auto-sync] Clearing stale cursor for org ${integration.organization_id}`);
          const { checkin_sync_cursor, checkin_sync_started_at, ...cleanMeta } = metadata;
          await supabase
            .from('integrations')
            .update({ metadata: cleanMeta })
            .eq('id', integration.id);
        } else {
          console.log(`[checkin-auto-sync] Skipping org ${integration.organization_id} (sync in progress)`);
          continue;
        }
      }

      // Determine if sync is due based on frequency
      let shouldSync = false;
      if (!lastCheckinSync) {
        shouldSync = true;
      } else {
        const lastSync = new Date(lastCheckinSync);
        const hoursSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);

        if (frequency === 'daily' && hoursSinceLastSync >= 24) {
          shouldSync = true;
        } else if (frequency === 'twice_daily' && hoursSinceLastSync >= 12) {
          shouldSync = true;
        }
      }

      if (!shouldSync) {
        console.log(`[checkin-auto-sync] Skipping org ${integration.organization_id} (last sync: ${lastCheckinSync}, freq: ${frequency})`);
        continue;
      }

      console.log(`[checkin-auto-sync] Triggering check-in sync for org ${integration.organization_id}`);

      // Loop: invoke pco-sync-checkins until hasMore is false
      try {
        let round = 0;
        let hasMore = true;

        while (hasMore && round < MAX_ROUNDS) {
          round++;
          console.log(`[checkin-auto-sync] Org ${integration.organization_id} round ${round}/${MAX_ROUNDS}`);

          const { data, error: invokeError } = await supabase.functions.invoke('pco-sync-checkins', {
            body: { integrationId: integration.id },
          });

          if (invokeError) {
            console.error(`[checkin-auto-sync] Error invoking sync round ${round}:`, invokeError.message);
            break;
          }

          hasMore = data?.hasMore === true;
          console.log(`[checkin-auto-sync] Round ${round} done. synced=${data?.synced}, hasMore=${hasMore}`);
        }

        triggeredCount++;
        console.log(`[checkin-auto-sync] Completed sync for org ${integration.organization_id} in ${round} round(s)`);

        // Refresh signal (marker) results so counts reflect the new check-ins.
        const { error: recomputeError } = await supabase.rpc('recompute_contact_markers', {
          p_org_id: integration.organization_id,
        });
        if (recomputeError) {
          console.error(`[checkin-auto-sync] Recompute failed for org ${integration.organization_id}:`, recomputeError.message);
        } else {
          console.log(`[checkin-auto-sync] Recomputed signals for org ${integration.organization_id}`);
        }
      } catch (err) {
        console.error(`[checkin-auto-sync] Failed sync for org ${integration.organization_id}:`, err);
      }

    }

    console.log(`[checkin-auto-sync] Done. Synced ${triggeredCount} of ${integrations.length} integrations`);

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

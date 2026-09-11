// Cron-triggered orchestrator: runs pco-sync-groups + pco-sync-group-attendance
// for every active PCO integration whose cadence is due.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MAX_ROUNDS = 15;
const MAX_ATT_ROUNDS = 40;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: integrations } = await supabase
      .from('integrations')
      .select('id, organization_id, metadata, sync_frequency')
      .eq('service_name', 'planning_center')
      .eq('status', 'active')
      .eq('auto_sync_all_people', true);

    if (!integrations?.length) {
      return new Response(JSON.stringify({ message: 'No integrations', synced: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const now = new Date();
    let triggered = 0;

    for (const integ of integrations) {
      const meta = (integ.metadata as any) || {};
      const last = meta.last_groups_sync_at;
      const lastAtt = meta.last_groups_attendance_sync_at;
      const attCursor = meta.groups_attendance_cursor_idx;
      const freq = integ.sync_frequency || 'daily';

      let due = !last;
      if (last) {
        const hrs = (now.getTime() - new Date(last).getTime()) / 3_600_000;
        if (freq === 'daily' && hrs >= 24) due = true;
        else if (freq === 'twice_daily' && hrs >= 12) due = true;
      }
      // Also due if the attendance pipeline hasn't finished since the last
      // groups sync (cursor stuck mid-list, or attendance never completed).
      const attIncomplete = attCursor !== undefined && attCursor !== null;
      const attStale = last && (!lastAtt || new Date(lastAtt) < new Date(last));
      if (attIncomplete || attStale) due = true;
      if (!due) continue;

      try {
        // Run groups sync to completion
        let more = true, round = 0;
        while (more && round < MAX_ROUNDS) {
          round++;
          const { data, error } = await supabase.functions.invoke('pco-sync-groups',
            { body: { integrationId: integ.id } });
          if (error) { console.error('[groups-auto] groups err', error.message); break; }
          more = data?.hasMore === true;
        }
        // Then attendance — drain cursor fully if possible
        more = true; round = 0;
        while (more && round < MAX_ATT_ROUNDS) {
          round++;
          const { data, error } = await supabase.functions.invoke('pco-sync-group-attendance',
            { body: { integrationId: integ.id } });
          if (error) { console.error('[groups-auto] att err', error.message); break; }
          more = data?.hasMore === true;
        }
        if (more) {
          console.warn(`[groups-auto] org ${integ.organization_id} attendance cursor did not drain in ${MAX_ATT_ROUNDS} rounds`);
        }
        triggered++;

        // Refresh signal (marker) results so group counts stay current.
        const { error: recomputeError } = await supabase.rpc('recompute_contact_markers', {
          p_org_id: integ.organization_id,
        });
        if (recomputeError) {
          console.error(`[groups-auto] recompute failed for org ${integ.organization_id}:`, recomputeError.message);
        }

      } catch (e) {
        console.error(`[groups-auto] org ${integ.organization_id} failed:`, e);
      }
    }

    return new Response(JSON.stringify({ success: true, triggered, checked: integrations.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

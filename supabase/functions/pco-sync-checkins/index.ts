import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { getPcoAuthHeader } from '../_shared/pco-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        const backoffDelay = Math.max(retryAfter * 1000, 1000 * Math.pow(2, attempt));
        console.log(`Rate limited (429). Waiting ${backoffDelay}ms before retry ${attempt + 1}/${maxRetries}`);
        if (attempt < maxRetries) {
          await sleep(backoffDelay);
          continue;
        }
        throw new Error(`Rate limited after ${maxRetries} retries`);
      }
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await sleep(1000 * Math.pow(2, attempt));
      }
    }
  }
  throw lastError || new Error('Fetch failed after retries');
}

const API_CALL_DELAY = 500;
const DEFAULT_MAX_PAGES = 30; // ~3000 records, well within 60s timeout

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { integrationId } = await req.json();

    // Authenticate user OR allow service-role calls (from auto-sync cron)
    const authHeader = req.headers.get('Authorization');
    const isServiceRole = authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '___none___');
    
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    if (!isServiceRole) {
      const { data: userData, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      if (authError || !userData.user) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }
    }

    if (!integrationId) {
      return new Response(JSON.stringify({ error: 'integrationId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get integration credentials
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('credentials, organization_id, metadata')
      .eq('id', integrationId)
      .single();

    if (integrationError || !integration) {
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { header: pcoAuthHeader } = await getPcoAuthHeader(supabase, integrationId);
    const orgId = integration.organization_id;
    const metadata = (integration.metadata as any) || {};

    // Check for a saved cursor (resuming a chunked sync)
    const savedCursor = metadata.checkin_sync_cursor || null;
    const lastCheckinSync = metadata.last_checkin_sync_at;
    const isIncremental = !savedCursor && !!lastCheckinSync;

    console.log(`Starting check-in sync for org ${orgId}. Mode: ${savedCursor ? 'RESUME' : isIncremental ? 'INCREMENTAL' : 'FULL'}`);

    // Determine start URL
    let startUrl: string;
    if (savedCursor) {
      startUrl = savedCursor;
      console.log(`Resuming from cursor: ${savedCursor}`);
    } else {
      startUrl = 'https://api.planningcenteronline.com/check-ins/v2/check_ins?per_page=100&include=event_times,locations,event';
      if (isIncremental && lastCheckinSync) {
        startUrl += `&where[updated_at][gte]=${encodeURIComponent(new Date(lastCheckinSync).toISOString())}`;
        console.log(`Incremental: fetching check-ins updated since ${lastCheckinSync}`);
      }
    }

    // Fetch check-ins with page cap
    let allCheckins: any[] = [];
    let nextUrl: string | null = startUrl;
    let pageCount = 0;

    const fetchHeaders = {
      'Authorization': pcoAuthHeader,
      'Content-Type': 'application/json',
    };

    while (nextUrl && pageCount < DEFAULT_MAX_PAGES) {
      pageCount++;
      console.log(`Fetching check-ins page ${pageCount}/${DEFAULT_MAX_PAGES}...`);

      const response = await fetchWithRetry(nextUrl, { headers: fetchHeaders });

      if (!response.ok) {
        if (response.status === 401) {
          return new Response(JSON.stringify({
            error: 'Planning Center authentication failed',
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`PCO API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const checkins = data.data || [];
      const included = data.included || [];

      for (const checkin of checkins) {
        const attrs = checkin.attributes || {};
        const relationships = checkin.relationships || {};

        const eventTimeId = relationships.event_times?.data?.[0]?.id ||
          relationships.event_time?.data?.id;
        const locationId = relationships.locations?.data?.[0]?.id ||
          relationships.location?.data?.id;
        const eventId = relationships.event?.data?.id;

        const eventTime = included.find((i: any) => i.type === 'EventTime' && i.id === eventTimeId);
        const location = included.find((i: any) => i.type === 'Location' && i.id === locationId);
        const event = included.find((i: any) => i.type === 'Event' && i.id === eventId);

        const personId = relationships.person?.data?.id || attrs.person_id;
        if (!personId) continue;

        allCheckins.push({
          pco_checkin_id: checkin.id,
          pc_person_id: personId,
          event_name: event?.attributes?.name || attrs.event_name || 'Unknown Event',
          event_time_name: eventTime?.attributes?.name || eventTime?.attributes?.starts_at || null,
          location_name: location?.attributes?.name || null,
          checkin_kind: attrs.kind || 'regular',
          checked_in_at: attrs.created_at || attrs.checked_in_at,
          checked_out_at: attrs.checked_out_at || null,
          metadata: {
            security_code: attrs.security_code,
            emergency_contact_name: attrs.emergency_contact_name,
            pco_event_id: eventId,
          },
        });
      }

      nextUrl = data.links?.next || data.meta?.next?.href || null;
      if (nextUrl) {
        await sleep(API_CALL_DELAY);
      }
    }

    const hasMore = !!nextUrl;
    console.log(`Fetched ${allCheckins.length} check-ins across ${pageCount} pages. hasMore: ${hasMore}`);

    // --- Upsert this chunk ---
    let upsertedCount = 0;
    let matchedCount = 0;

    if (allCheckins.length > 0) {
      // Match pc_person_id to contact_id
      const uniquePersonIds = [...new Set(allCheckins.map(c => c.pc_person_id))];
      console.log(`Matching ${uniquePersonIds.length} unique PCO person IDs to contacts...`);

      const contactMap = new Map<string, string>();
      const batchSize = 100;
      for (let i = 0; i < uniquePersonIds.length; i += batchSize) {
        const batch = uniquePersonIds.slice(i, i + batchSize);
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, pc_person_id')
          .eq('organization_id', orgId)
          .in('pc_person_id', batch);

        if (contacts) {
          for (const c of contacts) {
            if (c.pc_person_id) contactMap.set(c.pc_person_id, c.id);
          }
        }
      }

      matchedCount = contactMap.size;
      console.log(`Matched ${matchedCount} of ${uniquePersonIds.length} person IDs to contacts`);

      // Upsert check-ins in batches
      const upsertBatch = 50;
      for (let i = 0; i < allCheckins.length; i += upsertBatch) {
        const batch = allCheckins.slice(i, i + upsertBatch).map(checkin => ({
          organization_id: orgId,
          contact_id: contactMap.get(checkin.pc_person_id) || null,
          pc_person_id: checkin.pc_person_id,
          event_name: checkin.event_name,
          event_time_name: checkin.event_time_name,
          location_name: checkin.location_name,
          checkin_kind: checkin.checkin_kind?.toLowerCase() || 'regular',
          checked_in_at: checkin.checked_in_at,
          checked_out_at: checkin.checked_out_at,
          pco_checkin_id: checkin.pco_checkin_id,
          metadata: checkin.metadata,
        }));

        const { error: upsertError } = await supabase
          .from('pco_checkins')
          .upsert(batch, { onConflict: 'pco_checkin_id' });

        if (upsertError) {
          console.error(`Upsert error for batch ${i / upsertBatch + 1}:`, upsertError.message);
        } else {
          upsertedCount += batch.length;
        }
      }

      console.log(`Upserted ${upsertedCount} check-ins`);
    }

    // --- Handle cursor / finalization ---
    if (hasMore) {
      // Save cursor for next invocation
      console.log('More pages remain. Saving cursor...');
      await supabase
        .from('integrations')
        .update({
          metadata: {
            ...metadata,
            checkin_sync_cursor: nextUrl,
            checkin_sync_started_at: metadata.checkin_sync_started_at || new Date().toISOString(),
          },
        })
        .eq('id', integrationId);

      return new Response(JSON.stringify({
        success: true,
        hasMore: true,
        synced: upsertedCount,
        matched: matchedCount,
        pages: pageCount,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Final chunk — calculate engagement scores and update timestamps
      console.log('All pages fetched. Calculating engagement scores...');
      const { error: scoreError } = await supabase.rpc('calculate_engagement_scores', {
        p_org_id: orgId,
      });

      if (scoreError) {
        console.error('Error calculating engagement scores:', scoreError.message);
      } else {
        console.log('Engagement scores updated successfully');
      }

      // Clear cursor, update last sync timestamp
      const { checkin_sync_cursor, checkin_sync_started_at, ...cleanMetadata } = metadata;
      await supabase
        .from('integrations')
        .update({
          metadata: {
            ...cleanMetadata,
            last_checkin_sync_at: new Date().toISOString(),
            last_checkin_count: allCheckins.length,
          },
        })
        .eq('id', integrationId);

      return new Response(JSON.stringify({
        success: true,
        hasMore: false,
        synced: upsertedCount,
        matched: matchedCount,
        pages: pageCount,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in pco-sync-checkins:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

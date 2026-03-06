import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { integrationId } = await req.json();

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !userData.user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
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

    const credentials = integration.credentials as any;
    const application_id = credentials?.application_id;
    const secret = credentials?.secret;

    if (!application_id || !secret) {
      return new Response(JSON.stringify({ error: 'Missing Planning Center credentials' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const auth = btoa(`${application_id}:${secret}`);
    const orgId = integration.organization_id;

    // Check for last check-in sync timestamp for incremental sync
    const metadata = (integration.metadata as any) || {};
    const lastCheckinSync = metadata.last_checkin_sync_at;
    const isIncremental = !!lastCheckinSync;

    console.log(`Starting check-in sync for org ${orgId}. Mode: ${isIncremental ? 'INCREMENTAL' : 'FULL'}`);

    // Fetch check-ins from PCO Check-Ins API
    // The check-ins endpoint: /check-ins/v2/check_ins
    let allCheckins: any[] = [];
    let baseUrl = 'https://api.planningcenteronline.com/check-ins/v2/check_ins?per_page=100&include=event_times,locations,event';

    if (isIncremental && lastCheckinSync) {
      baseUrl += `&where[updated_at][gte]=${encodeURIComponent(new Date(lastCheckinSync).toISOString())}`;
      console.log(`Incremental: fetching check-ins updated since ${lastCheckinSync}`);
    }

    let nextUrl: string | null = baseUrl;
    let pageCount = 0;
    const maxPages = 500; // Safety limit

    const fetchHeaders = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    };

    while (nextUrl && pageCount < maxPages) {
      pageCount++;
      console.log(`Fetching check-ins page ${pageCount}...`);

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

        // Find related event_time and location from included
        const eventTimeId = relationships.event_times?.data?.[0]?.id ||
          relationships.event_time?.data?.id;
        const locationId = relationships.locations?.data?.[0]?.id ||
          relationships.location?.data?.id;
        const eventId = relationships.event?.data?.id;

        const eventTime = included.find((i: any) => i.type === 'EventTime' && i.id === eventTimeId);
        const location = included.find((i: any) => i.type === 'Location' && i.id === locationId);
        const event = included.find((i: any) => i.type === 'Event' && i.id === eventId);

        // Get person_id from the check-in
        const personId = relationships.person?.data?.id || attrs.person_id;

        if (!personId) {
          continue; // Skip check-ins without a person
        }

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

      // Follow pagination
      nextUrl = data.links?.next || data.meta?.next?.href || null;

      if (nextUrl) {
        await sleep(API_CALL_DELAY);
      }
    }

    console.log(`Fetched ${allCheckins.length} check-ins across ${pageCount} pages`);

    if (allCheckins.length === 0) {
      // Update last sync timestamp even if no new data
      await supabase
        .from('integrations')
        .update({
          metadata: {
            ...metadata,
            last_checkin_sync_at: new Date().toISOString(),
          },
        })
        .eq('id', integrationId);

      return new Response(JSON.stringify({
        success: true,
        message: 'No new check-ins found',
        synced: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Match pc_person_id to contact_id
    const uniquePersonIds = [...new Set(allCheckins.map(c => c.pc_person_id))];
    console.log(`Matching ${uniquePersonIds.length} unique PCO person IDs to contacts...`);

    // Fetch contacts in batches
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
          if (c.pc_person_id) {
            contactMap.set(c.pc_person_id, c.id);
          }
        }
      }
    }

    console.log(`Matched ${contactMap.size} of ${uniquePersonIds.length} person IDs to contacts`);

    // Upsert check-ins in batches
    let upsertedCount = 0;
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

    // Calculate engagement scores
    console.log('Calculating engagement scores...');
    const { error: scoreError } = await supabase.rpc('calculate_engagement_scores', {
      p_org_id: orgId,
    });

    if (scoreError) {
      console.error('Error calculating engagement scores:', scoreError.message);
    } else {
      console.log('Engagement scores updated successfully');
    }

    // Update last sync timestamp
    await supabase
      .from('integrations')
      .update({
        metadata: {
          ...metadata,
          last_checkin_sync_at: new Date().toISOString(),
          last_checkin_count: allCheckins.length,
        },
      })
      .eq('id', integrationId);

    return new Response(JSON.stringify({
      success: true,
      synced: upsertedCount,
      matched: contactMap.size,
      total_person_ids: uniquePersonIds.length,
      pages: pageCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

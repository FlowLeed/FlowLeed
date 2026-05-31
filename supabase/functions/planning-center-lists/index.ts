import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { syncDemographicData } from "../_shared/pco-demographics.ts";
import { getPcoAuthHeader } from "../_shared/pco-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, integrationId, listMappings } = await req.json();

    // Handle autoSync BEFORE authentication (called by cron with anon key)
    if (action === 'autoSync') {
      console.log('Auto-sync triggered by cron job');
      return await autoSyncAllMappings();
    }

    // For all other actions, require user authentication
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

    if (action === 'testConnection') {
      return await testPlanningCenterConnection(integrationId, userData.user.id);
    } else if (action === 'fetchLists') {
      return await fetchPlanningCenterLists(integrationId, userData.user.id);
    } else if (action === 'syncAllPeople') {
      return await syncAllPeopleFromPCO(integrationId, userData.user.id);
    } else if (action === 'syncLists') {
      // If mappings were provided directly, use them
      if (Array.isArray(listMappings) && listMappings.length > 0) {
        return await syncPlanningCenterLists(listMappings, userData.user.id);
      }

      // Otherwise, fetch list mappings for this integration
      if (!integrationId) {
        return new Response(JSON.stringify({ error: 'integrationId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: mappings, error: mappingsError } = await supabase
        .from('integration_list_mappings')
        .select(`
          *,
          pipelines (name, icon),
          pipeline_stages (name, color),
          integrations (user_id, sync_frequency)
        `)
        .eq('integration_id', integrationId)
        .eq('auto_sync', true);

      if (mappingsError) {
        console.error('Error fetching list mappings:', mappingsError);
        return new Response(JSON.stringify({ error: 'Failed to fetch list mappings' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!mappings || mappings.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'No list mappings configured for sync',
          results: []
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return await syncPlanningCenterLists(mappings, userData.user.id);
    }

    return new Response('Invalid action', { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error('Error in planning-center-lists function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function testPlanningCenterConnection(integrationId: string, userId: string) {
  try {
    console.log('Testing PC connection for integration:', integrationId, 'user:', userId);
    
    // Get integration credentials
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('credentials, settings, organization_id')
      .eq('id', integrationId)
      .single();

    if (integrationError) {
      console.error('Integration query error:', integrationError);
      return new Response(JSON.stringify({ success: false, error: 'Integration not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!integration) {
      console.error('No integration found');
      return new Response(JSON.stringify({ success: false, error: 'Integration not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Integration found:', integration);
    
    const { header: pcoAuthHeader, authType } = await getPcoAuthHeader(supabase, integrationId);
    console.log('Planning Center auth type:', authType);
    console.log('Making API call to Planning Center...');
    
    const response = await fetch('https://api.planningcenteronline.com/people/v2/me', {
      headers: {
        'Authorization': pcoAuthHeader,
        'Content-Type': 'application/json',
      },
    });

    console.log('PC API response status:', response.status);

    if (!response.ok) {
      console.error('PC API error:', response.status, response.statusText);
      
      // Update integration status to failed
      await supabase
        .from('integrations')
        .update({ status: 'failed' })
        .eq('id', integrationId);

      return new Response(JSON.stringify({ 
        success: false, 
        error: `PC API error: ${response.status} - ${response.statusText}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('PC API success:', data);
    
    // Update integration status to active and set last sync
    await supabase
      .from('integrations')
      .update({ 
        status: 'active',
        last_sync_at: new Date().toISOString()
      })
      .eq('id', integrationId);

    return new Response(JSON.stringify({ 
      success: true, 
      user: data.data.attributes,
      message: 'Successfully connected to Planning Center' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error testing PC connection:', error);
    
    // Update integration status to failed
    await supabase
      .from('integrations')
      .update({ status: 'failed' })
      .eq('id', integrationId);

    return new Response(JSON.stringify({ 
      success: false, 
      error: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function fetchPlanningCenterLists(integrationId: string, userId: string) {
  try {
    console.log('Fetching PC lists for integration:', integrationId);
    
    // Get integration credentials
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('credentials, settings, organization_id')
      .eq('id', integrationId)
      .single();

    if (integrationError || !integration) {
      console.error('Integration not found:', integrationError);
      return new Response('Integration not found', { status: 404, headers: corsHeaders });
    }

    // Access credentials properly from JSON field
    const credentials = integration.credentials as any;
    const application_id = credentials?.application_id;
    const secret = credentials?.secret;
    
    if (!application_id || !secret) {
      return new Response('Missing Planning Center credentials', { status: 400, headers: corsHeaders });
    }

    // Fetch ALL lists from Planning Center API with pagination
    const auth = btoa(`${application_id}:${secret}`);
    let allLists: any[] = [];
    let nextUrl: string | null = 'https://api.planningcenteronline.com/people/v2/lists?per_page=100';

    while (nextUrl) {
      console.log(`Fetching lists from: ${nextUrl}`);
      
      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`PC API error: ${response.status}`);
      }

      const data = await response.json();
      const lists = data.data || [];
      allLists = allLists.concat(lists);
      
      // Check for next page
      nextUrl = data.links?.next || null;
      
      console.log(`Fetched ${lists.length} lists, total so far: ${allLists.length}`);
    }

    console.log(`Total lists fetched: ${allLists.length}`);

    // First, delete old cached metadata for this integration to avoid duplicates
    await supabase
      .from('integration_list_metadata')
      .delete()
      .eq('integration_id', integrationId);

    // Cache fresh list metadata
    for (const list of allLists) {
      await supabase
        .from('integration_list_metadata')
        .insert({
          integration_id: integrationId,
          external_list_id: list.id,
          name: list.attributes.name,
          description: list.attributes.description,
          member_count: list.attributes.total_people || 0,
          list_type: list.attributes.list_type || 'static',
          last_updated_at: list.attributes.updated_at,
        });
    }

    return new Response(JSON.stringify({ lists: allLists }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching PC lists:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch lists' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Helper to extract household ID from included data
function extractHouseholdId(person: any, included: any[]): string | null {
  // Check if person has household relationships
  const householdRelData = person.relationships?.households?.data?.[0];
  if (householdRelData?.id) {
    return householdRelData.id;
  }
  
  // Fallback: find household in included that contains this person
  const household = included.find((item: any) => 
    item.type === 'Household' && 
    item.relationships?.people?.data?.some((p: any) => p.id === person.id)
  );
  
  return household?.id || null;
}

// Helper to extract addresses from included data for a person
function extractAddresses(person: any, included: any[]): any[] {
  const addressRelData = person.relationships?.addresses?.data || [];
  const addressIds = addressRelData.map((a: any) => a.id);
  return included.filter((item: any) => 
    item.type === 'Address' && addressIds.includes(item.id)
  );
}

// Helper to extract field data from included data for a person
function extractFieldData(person: any, included: any[]): any[] {
  const fieldRelData = person.relationships?.field_data?.data || [];
  const fieldIds = fieldRelData.map((f: any) => f.id);
  return included.filter((item: any) => 
    item.type === 'FieldDatum' && fieldIds.includes(item.id)
  );
}

// Sync ALL people from PCO (not just list members)
async function syncAllPeopleFromPCO(integrationId: string, userId: string) {
  try {
    console.log('Syncing ALL people from PCO for integration:', integrationId);
    
    // Get integration credentials
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('credentials, organization_id, user_id, last_full_sync_completed_at')
      .eq('id', integrationId)
      .single();

    if (integrationError || !integration) {
      console.error('Integration not found:', integrationError);
      return new Response(JSON.stringify({ error: 'Integration not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Cancel any existing "Sync All People" jobs before starting a new one
    const { data: existingJobs } = await supabase
      .from('pco_sync_jobs')
      .select('id')
      .eq('organization_id', integration.organization_id)
      .is('list_mapping_id', null) // Only "Sync All People" jobs
      .in('status', ['pending', 'processing']);

    if (existingJobs && existingJobs.length > 0) {
      const jobIds = existingJobs.map(j => j.id);
      console.log('Cancelling existing "Sync All People" jobs:', jobIds);
      
      // Cancel the jobs
      await supabase
        .from('pco_sync_jobs')
        .update({ status: 'cancelled' })
        .in('id', jobIds);
      
      // Cancel any pending queue items for these jobs
      await supabase
        .from('pco_sync_queue')
        .update({ status: 'cancelled' })
        .in('sync_job_id', jobIds)
        .eq('status', 'pending');
    }

    const credentials = integration.credentials as any;
    const application_id = credentials?.application_id;
    const secret = credentials?.secret;
    
    if (!application_id || !secret) {
      return new Response(JSON.stringify({ error: 'Missing Planning Center credentials' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const auth = btoa(`${application_id}:${secret}`);
    
    // Check if this is an incremental sync (has completed a full sync before)
    const isIncrementalSync = !!integration.last_full_sync_completed_at;
    const lastSyncAt = integration.last_full_sync_completed_at;
    
    console.log(`Sync mode: ${isIncrementalSync ? 'INCREMENTAL' : 'FULL'}, last sync: ${lastSyncAt || 'never'}`);
    
    // Fetch ALL people from PCO with pagination
    // OPTIMIZED: Include addresses, households, field_data to avoid re-fetching later
    let allPeople: any[] = [];
    let baseUrl = 'https://api.planningcenteronline.com/people/v2/people?per_page=100&include=emails,phone_numbers,addresses,households,field_data&where[status]=active';
    
    // For incremental sync, add updated_at filter
    if (isIncrementalSync && lastSyncAt) {
      const sinceDate = new Date(lastSyncAt).toISOString();
      baseUrl += `&where[updated_at][gte]=${encodeURIComponent(sinceDate)}`;
      console.log(`Incremental sync: fetching contacts updated since ${sinceDate}`);
    }
    
    let nextUrl: string | null = baseUrl;
    let pageCount = 0;

    while (nextUrl) {
      pageCount++;
      console.log(`Fetching people page ${pageCount}...`);
      
      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          await supabase
            .from('integrations')
            .update({ 
              status: 'failed',
              metadata: {
                error: 'Authentication failed - please check your Planning Center credentials',
                last_error_at: new Date().toISOString()
              }
            })
            .eq('id', integrationId);
          
          return new Response(JSON.stringify({ 
            error: 'Planning Center authentication failed - please reconnect your account' 
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        throw new Error(`PC API error: ${response.status}`);
      }

      const data = await response.json();
      const people = data.data || [];
      
      // Build person objects with included email/phone/address/household/field_data
      const included = data.included || [];
      
      for (const person of people) {
        // Find related emails and phones from included
        const personEmails = included.filter((i: any) => 
          i.type === 'Email' && 
          person.relationships?.emails?.data?.some((e: any) => e.id === i.id)
        );
        const personPhones = included.filter((i: any) => 
          i.type === 'PhoneNumber' && 
          person.relationships?.phone_numbers?.data?.some((p: any) => p.id === i.id)
        );
        
        // Extract pre-fetched data to pass to processor (avoids re-fetching)
        const householdId = extractHouseholdId(person, included);
        const addresses = extractAddresses(person, included);
        const fieldData = extractFieldData(person, included);
        
        // Attach to attributes for processing
        if (personEmails.length > 0) {
          person.attributes.emails = personEmails;
        }
        if (personPhones.length > 0) {
          person.attributes.phone_numbers = personPhones;
        }
        
        // Attach pre-fetched data as included_data for processor to use
        person.included_data = {
          householdId,
          addresses,
          fieldData,
          emails: personEmails,
          phones: personPhones,
        };
        
        allPeople.push(person);
      }
      
      nextUrl = data.links?.next || null;
      
      console.log(`Page ${pageCount}: fetched ${people.length} people, total: ${allPeople.length}`);
    }

    console.log(`Total people fetched: ${allPeople.length} in ${pageCount} pages (${isIncrementalSync ? 'incremental' : 'full'} sync)`);

    if (allPeople.length === 0) {
      // Update last sync time even if no changes
      await supabase
        .from('integrations')
        .update({ 
          last_sync_at: new Date().toISOString(),
          last_full_sync_completed_at: new Date().toISOString()
        })
        .eq('id', integrationId);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: isIncrementalSync ? 'No contacts modified since last sync' : 'No people found in Planning Center',
        totalContacts: 0,
        syncType: isIncrementalSync ? 'incremental' : 'full'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create sync job (without list_mapping_id for full people sync)
    const { data: job, error: jobError } = await supabase
      .from('pco_sync_jobs')
      .insert({
        organization_id: integration.organization_id,
        integration_id: integrationId,
        list_mapping_id: null, // No mapping for full people sync
        status: 'pending',
        total_contacts: allPeople.length,
        processed_contacts: 0,
        metadata: {
          sync_type: isIncrementalSync ? 'incremental_sync' : 'full_people_sync',
          pages_fetched: pageCount,
          includes_prefetched_data: true
        }
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('Failed to create sync job:', jobError);
      return new Response(JSON.stringify({ error: 'Failed to create sync job' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Created sync job: ${job.id}`);

    // Chunk contacts into batches of 25 (reduced from 50 for safer resource usage)
    const CHUNK_SIZE = 25;
    const chunks = [];
    for (let i = 0; i < allPeople.length; i += CHUNK_SIZE) {
      chunks.push(allPeople.slice(i, i + CHUNK_SIZE));
    }

    console.log(`Chunked ${allPeople.length} people into ${chunks.length} chunks`);

    // Insert chunks into queue
    const queueItems = chunks.map((chunk, index) => ({
      sync_job_id: job.id,
      organization_id: integration.organization_id,
      status: 'pending',
      chunk_data: chunk,
      chunk_number: index + 1
    }));

    // Insert queue items in batches to avoid timeout on large syncs
    const QUEUE_BATCH_SIZE = 50;
    console.log(`Inserting ${queueItems.length} queue items in batches of ${QUEUE_BATCH_SIZE}...`);
    
    for (let i = 0; i < queueItems.length; i += QUEUE_BATCH_SIZE) {
      const batch = queueItems.slice(i, i + QUEUE_BATCH_SIZE);
      const batchNumber = Math.floor(i / QUEUE_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(queueItems.length / QUEUE_BATCH_SIZE);
      
      const { error: queueError } = await supabase
        .from('pco_sync_queue')
        .insert(batch);

      if (queueError) {
        console.error(`Failed to create queue batch ${batchNumber}/${totalBatches}:`, queueError);
        await supabase
          .from('pco_sync_jobs')
          .update({ status: 'failed', error_message: `Failed to create queue items at batch ${batchNumber}` })
          .eq('id', job.id);
        
        return new Response(JSON.stringify({ error: 'Failed to create queue items' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`Inserted queue batch ${batchNumber}/${totalBatches}`);
    }

    // Update last sync time on integration
    await supabase
      .from('integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integrationId);

    // Track PCO sync
    await supabase.rpc('track_pco_sync', {
      p_org_id: integration.organization_id,
      p_sync_type: isIncrementalSync ? 'incremental_sync' : 'full_people_sync'
    });

    console.log(`${isIncrementalSync ? 'Incremental' : 'Full'} people sync job ${job.id} created with ${chunks.length} chunks`);

    return new Response(JSON.stringify({ 
      success: true,
      jobId: job.id,
      totalContacts: allPeople.length,
      chunks: chunks.length,
      syncType: isIncrementalSync ? 'incremental' : 'full'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error syncing all people from PCO:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function syncPlanningCenterLists(input: any, userId: string) {
  // Normalize to array to avoid "is not iterable" errors
  const mappings = Array.isArray(input) ? input : (input ? [input] : []);
  if (mappings.length === 0) {
    return new Response(JSON.stringify({ results: [], message: 'No list mappings to sync' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results = [];
  const orgIds = new Set<string>();

  for (const mapping of mappings) {
    try {
      const result = await syncSingleList(mapping, userId);
      results.push(result);
      
      // Collect organization IDs for tracking
      const { data: integration } = await supabase
        .from('integrations')
        .select('organization_id')
        .eq('id', mapping.integration_id)
        .single();
      
      if (integration?.organization_id) {
        orgIds.add(integration.organization_id);
      }
    } catch (error) {
      console.error(`Error syncing list ${mapping.external_list_id}:`, error);
      results.push({
        listId: mapping.external_list_id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Track PCO sync for each organization that had successful syncs
  for (const orgId of orgIds) {
    try {
      const { error: trackError } = await supabase.rpc('track_pco_sync', {
        p_org_id: orgId,
        p_sync_type: 'list_sync'
      });
      
      if (trackError) {
        console.error('Failed to track PCO sync (non-fatal):', trackError);
      }
    } catch (error) {
      console.error('Error tracking PCO sync:', error);
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function syncSingleList(mapping: any, userId: string) {
  console.log('Starting queue-based sync for list mapping:', mapping.id);
  
  // Get integration credentials and user_id
  const { data: integration } = await supabase
    .from('integrations')
    .select('credentials, organization_id, user_id')
    .eq('id', mapping.integration_id)
    .single();

  if (!integration) {
    throw new Error('Integration not found');
  }

  // Access credentials properly from JSON field
  const credentials = integration.credentials as any;
  const application_id = credentials?.application_id;
  const secret = credentials?.secret;
  
  if (!application_id || !secret) {
    throw new Error('Missing Planning Center credentials');
  }
  
  const auth = btoa(`${application_id}:${secret}`);
  
  console.log('Fetching PC list members for list:', mapping.external_list_id);

  // Fetch all list members from Planning Center using list_results endpoint with pagination
  // The /people endpoint has a 50-person cap, but /list_results properly paginates
  let allPeople: any[] = [];
  let nextUrl: string | null = `https://api.planningcenteronline.com/people/v2/lists/${mapping.external_list_id}/list_results?per_page=100&include=person`;
  let pageCount = 0;

  while (nextUrl) {
    pageCount++;
    console.log(`Fetching page ${pageCount} from Planning Center...`);
    
    const response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Handle authentication failures
      if (response.status === 401) {
        console.error('Planning Center authentication failed');
        
        // Update integration status to failed
        const { error: updateError } = await supabase
          .from('integrations')
          .update({ 
            status: 'failed',
            metadata: {
              error: 'Authentication failed - please check your Planning Center credentials',
              last_error_at: new Date().toISOString()
            }
          })
          .eq('id', mapping.integration_id);
        
        if (updateError) {
          console.error('Failed to update integration status:', updateError);
        }
        
        throw new Error('Planning Center authentication failed - please reconnect your account');
      }
      
      console.error('PC API error:', response.status, response.statusText);
      throw new Error(`PC API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Log pagination metadata for debugging
    console.log(`Page ${pageCount} response meta:`, {
      total_count: data.meta?.total_count,
      count: data.meta?.count,
      data_count: data.data?.length || 0,
      included_count: data.included?.length || 0,
      links: data.links ? Object.keys(data.links) : 'none'
    });
    
    // Extract person IDs from ListResult objects
    // Each ListResult has relationships.person.data.id - the /list_results endpoint
    // does NOT include full person data in the included array
    const listResults = data.data || [];
    const personRefs = listResults
      .filter((item: any) => item.type === 'ListResult' && item.relationships?.person?.data?.id)
      .map((item: any) => ({
        type: 'Person',
        id: item.relationships.person.data.id,
        // pco-sync-processor will fetch full person details including email/phone
      }));
    
    if (personRefs.length > 0) {
      allPeople.push(...personRefs);
    }
    
    // Get next page URL from links
    nextUrl = data.links?.next || null;
    
    console.log(`Page ${pageCount}: extracted ${personRefs.length} person IDs from ${listResults.length} list results, next URL: ${nextUrl ? 'yes' : 'no'}`);
  }

  console.log(`Total pages fetched: ${pageCount}, Total people: ${allPeople.length}`);

  // PREVENTION: Don't create sync jobs with 0 contacts
  if (allPeople.length === 0) {
    console.log(`List ${mapping.external_list_id} has 0 members - skipping job creation`);
    return {
      listId: mapping.external_list_id,
      success: true,
      contactsCount: 0,
      jobId: null,
      message: 'No contacts to sync in this list'
    };
  }

  // Create sync job
  const { data: job, error: jobError } = await supabase
    .from('pco_sync_jobs')
    .insert({
      organization_id: integration.organization_id,
      integration_id: mapping.integration_id,
      list_mapping_id: mapping.id,
      status: 'pending',
      total_contacts: allPeople.length,
      processed_contacts: 0,
      metadata: {
        list_name: mapping.external_list_name,
        list_id: mapping.external_list_id,
        pages_fetched: pageCount
      }
    })
    .select()
    .single();

  if (jobError || !job) {
    console.error('Failed to create sync job:', jobError);
    throw new Error('Failed to create sync job');
  }

  console.log(`Created sync job: ${job.id}`);

  // Chunk contacts into batches of 25 (reduced from 50 for safer resource usage)
  const CHUNK_SIZE = 25;
  const chunks = [];
  for (let i = 0; i < allPeople.length; i += CHUNK_SIZE) {
    chunks.push(allPeople.slice(i, i + CHUNK_SIZE));
  }

  console.log(`Chunked ${allPeople.length} contacts into ${chunks.length} chunks`);

  // Insert chunks into queue with organization_id for round-robin processing
  const queueItems = chunks.map((chunk, index) => ({
    sync_job_id: job.id,
    organization_id: integration.organization_id,
    status: 'pending',
    chunk_data: chunk,
    chunk_number: index + 1
  }));

  const { error: queueError } = await supabase
    .from('pco_sync_queue')
    .insert(queueItems);

  if (queueError) {
    console.error('Failed to create queue items:', queueError);
    // Update job status to failed
    await supabase
      .from('pco_sync_jobs')
      .update({ status: 'failed', error_message: 'Failed to create queue items' })
      .eq('id', job.id);
    throw new Error('Failed to create queue items');
  }

  console.log(`Created ${chunks.length} queue items for processing`);
  
  // Update list mapping last sync time
  await supabase
    .from('integration_list_mappings')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', mapping.id);

  // Track PCO sync
  await supabase.rpc('track_pco_sync', {
    p_org_id: integration.organization_id,
    p_sync_type: 'list_sync'
  });

  console.log(`Sync job ${job.id} created successfully with ${chunks.length} chunks queued`);

  return {
    listId: mapping.external_list_id,
    success: true,
    contactsCount: allPeople.length,
    jobId: job.id
  };
}

// syncDemographicData is now imported from _shared/pco-demographics.ts

// Helper function to check if enough time has passed for sync
function shouldSyncNow(lastSyncAt: string | null, frequency: string): boolean {
  if (!lastSyncAt) return true;
  
  const lastSync = new Date(lastSyncAt);
  const now = new Date();
  const diffMs = now.getTime() - lastSync.getTime();
  
  switch (frequency) {
    case 'daily':
      return diffMs >= 24 * 60 * 60 * 1000; // 24 hours
    case 'twice_daily':
      return diffMs >= 12 * 60 * 60 * 1000; // 12 hours
    case 'manual':
      return false; // Never auto-sync for manual
    default:
      return diffMs >= 24 * 60 * 60 * 1000; // Default to daily
  }
}

async function autoSyncAllMappings() {
  try {
    console.log('Starting automatic sync...');
    
    // ============================================
    // STEP 0: Always sync campuses for all active PCO integrations
    // ============================================
    console.log('Syncing campuses for all active PCO integrations...');
    const { data: allActiveIntegrations } = await supabase
      .from('integrations')
      .select('id, credentials, organization_id')
      .eq('service_name', 'planning_center')
      .eq('status', 'active');
    
    if (allActiveIntegrations && allActiveIntegrations.length > 0) {
      for (const integration of allActiveIntegrations) {
        try {
          const creds = integration.credentials as any;
          const appId = creds?.application_id ?? creds?.app_id;
          const secret = creds?.secret;
          if (appId && secret) {
            const auth = btoa(`${appId}:${secret}`);
            await syncCampusesFromPCO(integration.organization_id, auth);
          }
        } catch (e) {
          console.warn(`Campus sync failed for org ${integration.organization_id}:`, e);
        }
      }
    }
    
    // ============================================
    // STEP 1: Auto-Sync All People (NEW FEATURE)
    // ============================================
    console.log('Checking for integrations with auto_sync_all_people enabled...');
    
    const { data: autoSyncIntegrations, error: intError } = await supabase
      .from('integrations')
      .select('id, user_id, organization_id, sync_frequency, metadata, last_full_sync_completed_at')
      .eq('service_name', 'planning_center')
      .eq('status', 'active')
      .eq('auto_sync_all_people', true);
    
    if (intError) {
      console.error('Error fetching auto-sync integrations:', intError);
    } else if (autoSyncIntegrations && autoSyncIntegrations.length > 0) {
      console.log(`Found ${autoSyncIntegrations.length} integrations with auto-sync-all enabled`);
      
      for (const integration of autoSyncIntegrations) {
        const metadata = integration.metadata as { last_full_sync_at?: string } | null;
        // Use last_full_sync_completed_at for accurate delta calculation
        const lastFullSync = integration.last_full_sync_completed_at || metadata?.last_full_sync_at;
        const frequency = integration.sync_frequency || 'daily';
        
        // Skip if frequency is manual
        if (frequency === 'manual') {
          console.log(`Skipping integration ${integration.id} - manual sync only`);
          continue;
        }
        
        // Check if enough time has passed
        if (shouldSyncNow(lastFullSync || null, frequency)) {
          console.log(`Triggering full people sync for integration ${integration.id} (last sync: ${lastFullSync || 'never'})`);
          
          // Check for existing active job to prevent duplicates
          const { data: existingJob } = await supabase
            .from('pco_sync_jobs')
            .select('id')
            .eq('organization_id', integration.organization_id)
            .is('list_mapping_id', null)
            .in('status', ['pending', 'processing'])
            .maybeSingle();
          
          if (existingJob) {
            console.log(`Skipping integration ${integration.id} - sync job already in progress: ${existingJob.id}`);
            continue;
          }
          
          try {
            // Trigger the full sync using the existing function logic
            // Note: last_full_sync_completed_at is set inside triggerAutoFullPeopleSync
            // AFTER job and queue items are created, not before, to prevent race conditions
            await triggerAutoFullPeopleSync(integration.id, integration.organization_id, integration.last_full_sync_completed_at);
            
            console.log(`Successfully triggered auto full sync for integration ${integration.id}`);
          } catch (syncError) {
            console.error(`Error triggering full sync for integration ${integration.id}:`, syncError);
          }
        } else {
          console.log(`Skipping integration ${integration.id} - frequency ${frequency} not reached (last sync: ${lastFullSync})`);
        }
      }
    } else {
      console.log('No integrations with auto_sync_all_people enabled');
    }
    
    // ============================================
    // STEP 2: Auto-Sync List Mappings (EXISTING)
    // ============================================
    console.log('Checking for list mappings with auto_sync enabled...');
    
    const { data: allMappings, error: mappingsError } = await supabase
      .from('integration_list_mappings')
      .select(`
        *,
        pipelines!inner(name, icon),
        pipeline_stages!inner(name, color),
        integrations!inner(sync_frequency, user_id)
      `)
      .eq('auto_sync', true);
    
    if (mappingsError) {
      console.error('Error fetching mappings for auto-sync:', mappingsError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to fetch mappings for auto-sync' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!allMappings || allMappings.length === 0) {
      console.log('No active auto-sync mappings found');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Auto-sync complete (no list mappings to sync)',
        results: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`Found ${allMappings.length} active mappings for auto-sync`);
    
    const results = [];
    for (const mapping of allMappings) {
      try {
        const integration = mapping.integrations;
        const syncFrequency = integration.sync_frequency || 'daily';
        
        // Check if enough time has passed based on frequency setting
        const shouldSync = shouldSyncNow(mapping.last_sync_at, syncFrequency);
        if (!shouldSync) {
          const lastSyncTime = mapping.last_sync_at ? new Date(mapping.last_sync_at).toLocaleString() : 'never';
          console.log(`Skipping sync for mapping ${mapping.id} (${mapping.external_list_name}) - frequency ${syncFrequency} not reached. Last synced: ${lastSyncTime}`);
          continue;
        }
        
        console.log(`Auto-syncing mapping: ${mapping.external_list_name} (frequency: ${syncFrequency})`);
        const result = await syncSingleList(mapping, integration.user_id);
        results.push(result);
        
        // Update last_sync_at timestamp
        await supabase
          .from('integration_list_mappings')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', mapping.id);
        
        // Track PCO sync
        try {
          const { data: integrationData } = await supabase
            .from('integrations')
            .select('organization_id')
            .eq('id', mapping.integration_id)
            .single();
          
          if (integrationData?.organization_id) {
            await supabase.rpc('track_pco_sync', {
              p_org_id: integrationData.organization_id,
              p_sync_type: 'list_sync'
            });
          }
        } catch (trackError) {
          console.error('Error tracking auto-sync (non-fatal):', trackError);
        }
          
      } catch (error) {
        console.error(`Error auto-syncing mapping ${mapping.id}:`, error);
        results.push({
          listId: mapping.external_list_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    const successfulSyncs = results.filter(r => r.success).length;
    console.log(`Auto-sync completed: ${successfulSyncs}/${allMappings.length} mappings synced successfully`);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `Auto-sync completed: ${successfulSyncs}/${allMappings.length} mappings synced successfully`,
      synced: successfulSyncs,
      total: allMappings.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in auto-sync:', error);
    return new Response(JSON.stringify({ 
      error: 'Auto-sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Helper to sync campuses from PCO directly
async function syncCampusesFromPCO(organizationId: string, auth: string) {
  try {
    console.log(`🏛️ Syncing campuses for org ${organizationId}`);
    
    const response = await fetch(
      'https://api.planningcenteronline.com/people/v2/campuses',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.warn(`Failed to fetch campuses: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    const campuses = data.data || [];
    
    if (campuses.length === 0) {
      console.log('No campuses found in PCO');
      return;
    }
    
    console.log(`Found ${campuses.length} campuses in PCO`);
    
    for (const campus of campuses) {
      const attrs = campus.attributes || {};
      const { error } = await supabase
        .from('campuses')
        .upsert({
          organization_id: organizationId,
          pco_campus_id: campus.id,
          name: attrs.name || 'Unknown Campus',
          address: attrs.street || null,
          city: attrs.city || null,
          state: attrs.state || null,
          zip_code: attrs.zip || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,pco_campus_id',
          ignoreDuplicates: false,
        });
      
      if (error) {
        console.error(`Error upserting campus ${campus.id}:`, error);
      } else {
        console.log(`✅ Campus synced: ${attrs.name}`);
      }
    }
  } catch (error) {
    console.warn('Campus sync failed (non-fatal):', error);
  }
}

// Trigger a full people sync for auto-sync (no user auth required)
// Supports incremental sync by using last_full_sync_completed_at
async function triggerAutoFullPeopleSync(integrationId: string, organizationId: string, lastFullSyncCompletedAt?: string | null) {
  console.log('Starting auto full people sync for integration:', integrationId);
  
  // Get integration credentials
  const { data: integration, error: integrationError } = await supabase
    .from('integrations')
    .select('credentials, organization_id, user_id')
    .eq('id', integrationId)
    .single();

  if (integrationError || !integration) {
    throw new Error('Integration not found');
  }

  const credentials = integration.credentials as any;
  const application_id = credentials?.application_id;
  const secret = credentials?.secret;
  
  if (!application_id || !secret) {
    throw new Error('Missing Planning Center credentials');
  }

  const auth = btoa(`${application_id}:${secret}`);
  
  // Determine if this is an incremental sync
  const isIncrementalSync = !!lastFullSyncCompletedAt;
  
  // Build URL with pre-fetched data and optional incremental filter
  let baseUrl = 'https://api.planningcenteronline.com/people/v2/people?per_page=100&include=emails,phone_numbers,addresses,households,field_data&where[status]=active';
  
  if (isIncrementalSync && lastFullSyncCompletedAt) {
    const sinceDate = new Date(lastFullSyncCompletedAt).toISOString();
    baseUrl += `&where[updated_at][gte]=${encodeURIComponent(sinceDate)}`;
    console.log(`[Auto-sync] Incremental sync: fetching contacts updated since ${sinceDate}`);
  } else {
    console.log(`[Auto-sync] Full sync: fetching all contacts`);
  }
  
  // Fetch ALL people from PCO with pagination
  let allPeople: any[] = [];
  let nextUrl: string | null = baseUrl;
  let pageCount = 0;

  while (nextUrl) {
    pageCount++;
    console.log(`[Auto-sync] Fetching people page ${pageCount}...`);
    
    const response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await supabase
          .from('integrations')
          .update({ 
            status: 'failed',
            metadata: {
              error: 'Authentication failed during auto-sync',
              last_error_at: new Date().toISOString()
            }
          })
          .eq('id', integrationId);
        
        throw new Error('Planning Center authentication failed');
      }
      throw new Error(`PC API error: ${response.status}`);
    }

    const data = await response.json();
    const people = data.data || [];
    const included = data.included || [];
    
    for (const person of people) {
      const personEmails = included.filter((i: any) => 
        i.type === 'Email' && 
        person.relationships?.emails?.data?.some((e: any) => e.id === i.id)
      );
      const personPhones = included.filter((i: any) => 
        i.type === 'PhoneNumber' && 
        person.relationships?.phone_numbers?.data?.some((p: any) => p.id === i.id)
      );
      
      // Extract pre-fetched data
      const householdId = extractHouseholdId(person, included);
      const addresses = extractAddresses(person, included);
      const fieldData = extractFieldData(person, included);
      
      if (personEmails.length > 0) {
        person.attributes.emails = personEmails;
      }
      if (personPhones.length > 0) {
        person.attributes.phone_numbers = personPhones;
      }
      
      // Attach pre-fetched data
      person.included_data = {
        householdId,
        addresses,
        fieldData,
        emails: personEmails,
        phones: personPhones,
      };
      
      allPeople.push(person);
    }
    
    nextUrl = data.links?.next || null;
    console.log(`[Auto-sync] Page ${pageCount}: fetched ${people.length} people, total: ${allPeople.length}`);
  }

  console.log(`[Auto-sync] Total people fetched: ${allPeople.length} in ${pageCount} pages (${isIncrementalSync ? 'incremental' : 'full'} sync)`);

  // Always sync campuses, even if no contacts changed
  await syncCampusesFromPCO(organizationId, auth);

  if (allPeople.length === 0) {
    console.log('[Auto-sync] No people found/modified in Planning Center');
    return;
  }

  // Create sync job
  const { data: job, error: jobError } = await supabase
    .from('pco_sync_jobs')
    .insert({
      organization_id: organizationId,
      integration_id: integrationId,
      list_mapping_id: null,
      status: 'pending',
      total_contacts: allPeople.length,
      processed_contacts: 0,
      metadata: {
        sync_type: isIncrementalSync ? 'auto_incremental_sync' : 'auto_full_people_sync',
        pages_fetched: pageCount,
        includes_prefetched_data: true
      }
    })
    .select()
    .single();

  if (jobError || !job) {
    throw new Error('Failed to create sync job');
  }

  console.log(`[Auto-sync] Created sync job: ${job.id}`);

  // CRITICAL: Set last_full_sync_completed_at IMMEDIATELY after job creation
  // This ensures incremental sync works even if edge function times out during chunk creation
  // Without this, large orgs (15k+ contacts) never complete chunk creation before timeout,
  // leaving last_full_sync_completed_at NULL and causing endless full syncs
  await supabase
    .from('integrations')
    .update({ 
      last_sync_at: new Date().toISOString(),
      last_full_sync_completed_at: new Date().toISOString()
    })
    .eq('id', integrationId);

  console.log(`[Auto-sync] Set last_full_sync_completed_at immediately after job creation`);

  // Chunk contacts into batches
  const CHUNK_SIZE = 25;
  const chunks = [];
  for (let i = 0; i < allPeople.length; i += CHUNK_SIZE) {
    chunks.push(allPeople.slice(i, i + CHUNK_SIZE));
  }

  // Insert chunks into queue
  const queueItems = chunks.map((chunk, index) => ({
    sync_job_id: job.id,
    organization_id: organizationId,
    status: 'pending',
    chunk_data: chunk,
    chunk_number: index + 1
  }));

  const QUEUE_BATCH_SIZE = 50;
  for (let i = 0; i < queueItems.length; i += QUEUE_BATCH_SIZE) {
    const batch = queueItems.slice(i, i + QUEUE_BATCH_SIZE);
    const { error: queueError } = await supabase
      .from('pco_sync_queue')
      .insert(batch);

    if (queueError) {
      console.error(`[Auto-sync] Failed to create queue batch:`, queueError);
      await supabase
        .from('pco_sync_jobs')
        .update({ status: 'failed', error_message: 'Failed to create queue items' })
        .eq('id', job.id);
      throw new Error('Failed to create queue items');
    }
  }

  // Track PCO sync
  await supabase.rpc('track_pco_sync', {
    p_org_id: organizationId,
    p_sync_type: isIncrementalSync ? 'auto_incremental_sync' : 'auto_full_people_sync'
  });

  console.log(`[Auto-sync] ${isIncrementalSync ? 'Incremental' : 'Full'} people sync job ${job.id} created with ${chunks.length} chunks`);
}

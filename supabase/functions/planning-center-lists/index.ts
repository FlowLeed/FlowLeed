import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    
    // Access credentials properly from JSON field
    const credentials = integration.credentials as any;
    const application_id = credentials?.application_id;
    const secret = credentials?.secret;
    
    console.log('Credentials check - has app_id:', !!application_id, 'has secret:', !!secret);

    if (!application_id || !secret) {
      console.error('Missing credentials:', { has_app_id: !!application_id, has_secret: !!secret });
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing Planning Center credentials' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Test API connection with a simple endpoint
    const auth = btoa(`${application_id}:${secret}`);
    console.log('Making API call to Planning Center...');
    
    const response = await fetch('https://api.planningcenteronline.com/people/v2/me', {
      headers: {
        'Authorization': `Basic ${auth}`,
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

  // Fetch all list members from Planning Center with pagination
  let allPeople: any[] = [];
  let nextUrl: string | null = `https://api.planningcenteronline.com/people/v2/lists/${mapping.external_list_id}/people?per_page=100`;
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
      console.error('PC API error:', response.status, response.statusText);
      throw new Error(`PC API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Collect people from data array (direct endpoint returns people in data)
    const dataCount = data.data?.length || 0;
    const pagePeople = data.data || [];
    if (pagePeople.length > 0) {
      allPeople.push(...pagePeople);
    }
    
    // Get next page URL from links
    nextUrl = data.links?.next || null;
    
    console.log(`Page ${pageCount}: data length: ${dataCount}, people: ${pagePeople.length}`);
  }

  console.log(`Total pages fetched: ${pageCount}, Total people: ${allPeople.length}`);

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

  // Chunk contacts into batches of 50
  const CHUNK_SIZE = 50;
  const chunks = [];
  for (let i = 0; i < allPeople.length; i += CHUNK_SIZE) {
    chunks.push(allPeople.slice(i, i + CHUNK_SIZE));
  }

  console.log(`Chunked ${allPeople.length} contacts into ${chunks.length} chunks`);

  // Insert chunks into queue
  const queueItems = chunks.map((chunk, index) => ({
    sync_job_id: job.id,
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

// Sync demographic data to database tables
async function syncDemographicData(contactId: string, person: any, auth: string) {
  const attrs = person.attributes;
  const includedData = person.included_data || {};
  
  try {
    // 1. Sync demographics (birthday, marital status, occupation, gender)
    const demoData: any = {};
    
    // Handle built-in PCO fields
    if (attrs.birthdate) demoData.birthday = attrs.birthdate;
    if (attrs.marital_status) demoData.marital_status = attrs.marital_status;
    if (attrs.occupation) demoData.occupation = attrs.occupation;
    if (attrs.gender) demoData.gender = attrs.gender;
    if (attrs.sex) demoData.gender = attrs.sex; // Some PCO versions use 'sex' instead
    
    console.log('Initial demographic data from attrs:', demoData);
    
    // Handle custom fields that might contain marital status or occupation
    if (includedData.fieldData && includedData.fieldData.length > 0) {
      console.log('Checking custom fields for demographic data:', includedData.fieldData.length, 'fields');
      
      for (const field of includedData.fieldData) {
        const fieldAttrs = field.attributes;
        const fieldName = fieldAttrs.name?.toLowerCase() || '';
        const fieldValue = fieldAttrs.value?.trim();
        
        console.log('Processing custom field:', fieldName, '=', fieldValue);
        
        // Check for marital status fields
        if (fieldValue && (
          fieldName.includes('marital') || 
          fieldName.includes('married') || 
          fieldName.includes('single') ||
          fieldName.includes('relationship status') ||
          fieldName === 'status' // Sometimes just called "status"
        )) {
          demoData.marital_status = fieldValue;
          console.log('Found marital status in custom field:', fieldName, '=', fieldValue);
        }
        
        // Check for occupation fields
        if (fieldValue && (
          fieldName.includes('occupation') || 
          fieldName.includes('job') || 
          fieldName.includes('work') ||
          fieldName.includes('employment') ||
          fieldName.includes('profession')
        )) {
          demoData.occupation = fieldValue;
          console.log('Found occupation in custom field:', fieldName, '=', fieldValue);
        }
      }
    }
    
    // Fallback to relationship-included marital status
    if (!demoData.marital_status && includedData.maritalStatus && includedData.maritalStatus.attributes) {
      const msAttrs = includedData.maritalStatus.attributes;
      demoData.marital_status = msAttrs.name || msAttrs.label || msAttrs.value || msAttrs.status || null;
      if (demoData.marital_status) {
        console.log('Found marital status via relationship include:', demoData.marital_status);
      }
    }
    
    // Also check if marital status is in demographic info (some payloads)
    if (!demoData.marital_status && includedData.demographic && includedData.demographic.attributes) {
      const dAttrs = includedData.demographic.attributes;
      demoData.marital_status = dAttrs.marital_status || dAttrs.maritalStatus || null;
      if (demoData.marital_status) {
        console.log('Found marital status in demographic data:', demoData.marital_status);
      }
    }
    
    // Title-case common enum-like values if needed
    if (typeof demoData.marital_status === 'string') {
      const s = demoData.marital_status.trim();
      if (s && s === s.toLowerCase()) {
        demoData.marital_status = s.charAt(0).toUpperCase() + s.slice(1);
      }
    }
    
    console.log('Final demographics data to sync:', demoData);
    if (Object.keys(demoData).length > 0) {
      console.log('Syncing demographics for contact:', contactId);
      
      // Check if demographics record exists
      const { data: existingDemo } = await supabase
        .from('contact_demographics')
        .select('id')
        .eq('contact_id', contactId)
        .maybeSingle();
      
      if (existingDemo) {
        const { error: updateError } = await supabase
          .from('contact_demographics')
          .update(demoData)
          .eq('id', existingDemo.id);
        
        if (updateError) {
          console.error('Error updating demographics:', updateError);
        } else {
          console.log('Successfully updated demographics');
        }
      } else {
        const { error: insertError } = await supabase
          .from('contact_demographics')
          .insert({ contact_id: contactId, ...demoData });
        
        if (insertError) {
          console.error('Error inserting demographics:', insertError);
        } else {
          console.log('Successfully inserted demographics');
        }
      }
    }
    
    // 2. Sync addresses
    if (includedData.addresses && includedData.addresses.length > 0) {
      console.log('Syncing addresses for contact:', contactId);
      
      // Clear existing addresses to avoid duplicates
      await supabase
        .from('contact_addresses')
        .delete()
        .eq('contact_id', contactId);
      
      for (const [index, address] of includedData.addresses.entries()) {
        const addrAttrs = address.attributes;
        console.log('Processing address attributes:', JSON.stringify(addrAttrs, null, 2));
        
        // Planning Center may use different field names for street address
        const line1 = addrAttrs.street || addrAttrs.street_address || addrAttrs.address || addrAttrs.line1 || addrAttrs.street_line_1 || null;
        const line2 = addrAttrs.street_line_2 || addrAttrs.line2 || null;
        const streetAddress = [line1, line2].filter(Boolean).join(', ') || null;
        
        const addressData = {
          contact_id: contactId,
          address_type: addrAttrs.location?.toLowerCase() || 'home',
          street_address: streetAddress,
          city: addrAttrs.city,
          state: addrAttrs.state,
          zip_code: addrAttrs.zip,
          country: addrAttrs.country_code || addrAttrs.country || 'US',
          is_primary: addrAttrs.primary || index === 0 // Use PCO primary field if available, otherwise first address
        };
        
        console.log('Inserting address data:', JSON.stringify(addressData, null, 2));
        
        await supabase
          .from('contact_addresses')
          .insert(addressData);
      }
    }
    
    // 3. Sync family/household data  
    if (includedData.households && includedData.households.length > 0) {
      console.log(`Found ${includedData.households.length} households for person ${person.id}`);
      
      // First, clear existing Planning Center-sourced family members
      const { error: deleteError } = await supabase
        .from('contact_family_members')
        .delete()
        .eq('contact_id', contactId)
        .not('pc_person_id', 'is', null);
      
      if (deleteError) {
        console.error('Error clearing existing family members:', deleteError);
      }
      
      const familyMembers = [];
      const seenPersonIds = new Set<string>(); // Prevent duplicates across households
      
      for (const household of includedData.households) {
        const householdName = household.attributes?.name || 'Unknown Household';
        console.log(`Fetching household members for household ${household.id}`);
        
        try {
          // Fetch household memberships with person details
          const householdResponse = await fetch(
            `https://api.planningcenteronline.com/people/v2/households/${household.id}/household_memberships?include=person`,
            {
              headers: {
                'Authorization': `Basic ${auth}`,
              },
            }
          );
          
          if (!householdResponse.ok) {
            console.error(`Failed to fetch household memberships: ${householdResponse.status}`);
            continue;
          }
          
          const householdData = await householdResponse.json();
          const memberships = householdData.data || [];
          const includedPeople = householdData.included?.filter((i: any) => i.type === 'Person') || [];
          
          console.log(`Found ${memberships.length} members in household ${household.id}`);
          
          for (const membership of memberships) {
            const personId = membership.relationships?.person?.data?.id;
            
            // Skip if this is the primary contact or already processed
            if (personId === person.id || seenPersonIds.has(personId)) continue;
            
            // Find the person data in included
            const memberPerson = includedPeople.find((p: any) => p.id === personId);
            
            if (memberPerson) {
              const memberAttrs = memberPerson.attributes;
              const birthdate = memberAttrs.birthdate;
              let isChild = memberAttrs.child || false;
              
              // Calculate if child based on age if birthdate available and child flag not set
              if (birthdate && !isChild) {
                const age = new Date().getFullYear() - new Date(birthdate).getFullYear();
                isChild = age < 18;
              }
              
              seenPersonIds.add(personId);
              
              familyMembers.push({
                contact_id: contactId,
                name: `${memberAttrs.first_name || ''} ${memberAttrs.last_name || ''}`.trim(),
                relationship: isChild ? 'Child' : (memberAttrs.marital_status === 'Married' ? 'Spouse' : 'Household Member'),
                birthday: birthdate,
                avatar: memberAttrs.avatar || memberAttrs.demographic_avatar_url,
                is_child: isChild,
                pc_person_id: personId,
                notes: `Household: ${householdName}`
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching household ${household.id}:`, error);
        }
      }
      
      if (familyMembers.length > 0) {
        console.log(`Inserting ${familyMembers.length} family members`);
        const { error: familyError } = await supabase
          .from('contact_family_members')
          .insert(familyMembers);
        
        if (familyError) {
          console.error('Error syncing family members:', familyError);
        }
      }
    }
    
    // 4. Sync custom field data as notes
    if (includedData.fieldData && includedData.fieldData.length > 0) {
      console.log('Syncing custom field data for contact:', contactId);
      
      for (const field of includedData.fieldData) {
        const fieldAttrs = field.attributes;
        if (fieldAttrs.value && fieldAttrs.value.trim()) {
          // Check if note already exists for this field
          const noteContent = `${fieldAttrs.name || 'Custom Field'}: ${fieldAttrs.value}`;
          const { data: existingNote } = await supabase
            .from('contact_notes')
            .select('id')
            .eq('contact_id', contactId)
            .eq('content', noteContent)
            .eq('note_type', 'planning_center_field')
            .maybeSingle();
          
          if (!existingNote) {
            await supabase
              .from('contact_notes')
              .insert({
                contact_id: contactId,
                content: noteContent,
                note_type: 'planning_center_field',
                created_by_user_id: (await supabase.auth.getUser()).data.user?.id || contactId
              });
          }
        }
      }
    }
    
    console.log('Successfully synced demographic data for contact:', contactId);
  } catch (error) {
    console.error('Error syncing demographic data for contact:', contactId, error);
    // Continue processing other contacts even if demographic sync fails
  }
}

// Helper function to check if enough time has passed for sync
function shouldSyncNow(lastSyncAt: string | null, frequency: string): boolean {
  if (!lastSyncAt) return true;
  
  const lastSync = new Date(lastSyncAt);
  const now = new Date();
  const diffMs = now.getTime() - lastSync.getTime();
  
  switch (frequency) {
    case 'every_5_minutes':
      return diffMs >= 5 * 60 * 1000;
    case 'every_15_minutes':
      return diffMs >= 15 * 60 * 1000;
    case 'every_30_minutes':
      return diffMs >= 30 * 60 * 1000;
    case 'hourly':
      return diffMs >= 60 * 60 * 1000;
    case 'daily':
      return diffMs >= 24 * 60 * 60 * 1000;
    case 'weekly':
      return diffMs >= 7 * 24 * 60 * 60 * 1000;
    case 'manual':
      return false; // Never auto-sync for manual
    default:
      return diffMs >= 15 * 60 * 1000; // Default to 15 minutes
  }
}

async function autoSyncAllMappings() {
  try {
    console.log('Starting automatic sync of all active list mappings...');
    
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
        message: 'No active auto-sync mappings found',
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
        const syncFrequency = integration.sync_frequency || 'every_15_minutes';
        
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
        
        // Track PCO sync (note: syncSingleList already tracks, but this is extra safety for auto-sync)
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

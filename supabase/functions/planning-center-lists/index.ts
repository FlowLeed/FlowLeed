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

    const { action, integrationId, listMappings } = await req.json();

    if (action === 'testConnection') {
      return await testPlanningCenterConnection(integrationId, userData.user.id);
    } else if (action === 'fetchLists') {
      return await fetchPlanningCenterLists(integrationId, userData.user.id);
    } else if (action === 'syncLists') {
      return await syncPlanningCenterLists(listMappings, userData.user.id);
    } else if (action === 'autoSync') {
      // Auto sync all active mappings - no user required for cron jobs
      return await autoSyncAllMappings();
    }

    return new Response('Invalid action', { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error('Error in planning-center-lists function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
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
      .select('credentials, settings')
      .eq('id', integrationId)
      .eq('user_id', userId)
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
      error: `Connection error: ${error.message}` 
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
      .select('credentials, settings')
      .eq('id', integrationId)
      .eq('user_id', userId)
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

    // Fetch lists from Planning Center API
    const auth = btoa(`${application_id}:${secret}`);
    const response = await fetch('https://api.planningcenteronline.com/people/v2/lists', {
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

    // Cache list metadata
    for (const list of lists) {
      await supabase
        .from('integration_list_metadata')
        .upsert({
          integration_id: integrationId,
          external_list_id: list.id,
          name: list.attributes.name,
          description: list.attributes.description,
          member_count: list.attributes.total_people || 0,
          list_type: list.attributes.list_type || 'static',
          last_updated_at: list.attributes.updated_at,
        });
    }

    return new Response(JSON.stringify({ lists }), {
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

async function syncPlanningCenterLists(listMappings: any[], userId: string) {
  const results = [];

  for (const mapping of listMappings) {
    try {
      const result = await syncSingleList(mapping, userId);
      results.push(result);
    } catch (error) {
      console.error(`Error syncing list ${mapping.external_list_id}:`, error);
      results.push({
        listId: mapping.external_list_id,
        success: false,
        error: error.message,
      });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function syncSingleList(mapping: any, userId: string) {
  console.log('Syncing single list:', mapping);
  
  // Get integration credentials
  const { data: integration } = await supabase
    .from('integrations')
    .select('credentials, organization_id')
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

  // Fetch list members from Planning Center
  const response = await fetch(
    `https://api.planningcenteronline.com/people/v2/lists/${mapping.external_list_id}/list_results?include=person`,
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    console.error('PC API error:', response.status, response.statusText);
    throw new Error(`PC API error: ${response.status}`);
  }

  const data = await response.json();
  console.log('PC API response structure:', {
    hasData: !!data.data,
    dataLength: data.data?.length || 0,
    hasIncluded: !!data.included,
    includedLength: data.included?.length || 0,
    sampleData: data.data?.[0],
    sampleIncluded: data.included?.[0]
  });
  
  // Get people from included data if available, otherwise fetch them individually
  let people = data.included?.filter((item: any) => item.type === 'Person') || [];
  console.log('Found people in included:', people.length);
  
  // If no people found in included, fetch them individually from list results
  if (people.length === 0 && data.data?.length > 0) {
    console.log('No people found in included, fetching individual people...');
    console.log('List results sample:', JSON.stringify(data.data[0], null, 2));
    
    for (const [index, result] of data.data.entries()) {
      console.log(`Processing list result ${index + 1}:`, JSON.stringify(result, null, 2));
      
      if (result.relationships?.person?.data?.id) {
        const personId = result.relationships.person.data.id;
        console.log('Fetching person details for:', personId);
        
        try {
          const personResponse = await fetch(
            `https://api.planningcenteronline.com/people/v2/people/${personId}?include=emails,phone_numbers`,
            {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (personResponse.ok) {
            const personData = await personResponse.json();
            console.log('Person data received:', JSON.stringify(personData, null, 2));
            if (personData.data) {
              // Merge person data with email and phone data from included
              const person = personData.data;
              const emails = personData.included?.filter((item: any) => item.type === 'Email') || [];
              const phoneNumbers = personData.included?.filter((item: any) => item.type === 'PhoneNumber') || [];
              
              // Add email and phone data to person attributes
              const primaryEmail = emails.find((email: any) => email.attributes.primary)?.attributes.address;
              const primaryPhone = phoneNumbers.find((phone: any) => phone.attributes.primary)?.attributes.number;
              
              person.attributes.primary_email = primaryEmail || person.attributes.primary_email;
              person.attributes.primary_phone_number = primaryPhone || person.attributes.primary_phone_number;
              
              console.log('Enhanced person with contact info:', JSON.stringify(person.attributes, null, 2));
              people.push(person);
            }
          } else {
            console.error(`Failed to fetch person ${personId}:`, personResponse.status);
          }
        } catch (error) {
          console.error(`Error fetching person ${personId}:`, error);
        }
      } else {
        console.log('No person ID found in result:', JSON.stringify(result, null, 2));
      }
    }
  }
  
  console.log('Total people found:', people.length);

  let contactsAdded = 0;
  let contactsUpdated = 0;

  for (const person of people) {
    const personId = person.id;
    const attrs = person.attributes;
    
    console.log('Processing person:', personId, attrs.first_name, attrs.last_name);
    console.log('Person attributes:', JSON.stringify(attrs, null, 2));

    // Check if contact already exists using maybeSingle to avoid errors
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('pc_person_id', personId)
      .eq('organization_id', integration.organization_id)
      .maybeSingle();

    const contactData = {
      name: `${attrs.first_name || ''} ${attrs.last_name || ''}`.trim() || 'Unknown',
      email: attrs.primary_email || attrs.email || null,
      phone: attrs.primary_phone_number || attrs.phone_number || attrs.phone || null,
      avatar: attrs.avatar || attrs.demographic_avatar_url || null,
      pc_person_id: personId,
      source_type: 'planning_center',
      last_synced_at: new Date().toISOString(),
      organization_id: integration.organization_id,
    };

    console.log('Contact data to save:', JSON.stringify(contactData, null, 2));

    let contactId;

    if (existingContact) {
      // Update existing contact
      console.log('Updating existing contact:', existingContact.id);
      const { data: updatedContact } = await supabase
        .from('contacts')
        .update(contactData)
        .eq('id', existingContact.id)
        .select('id')
        .single();
      
      contactId = updatedContact?.id;
      contactsUpdated++;
    } else {
      // Create new contact
      console.log('Creating new contact for person:', personId);
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert(contactData)
        .select('id')
        .single();
      
      if (contactError) {
        console.error('Error creating contact:', contactError);
        continue; // Skip this person and continue with others
      }
      
      contactId = newContact?.id;
      contactsAdded++;
    }

    if (contactId) {
      console.log('Adding contact to pipeline:', contactId, 'pipeline:', mapping.pipeline_id, 'stage:', mapping.stage_id);
      
      // Add to pipeline stage if not already there using maybeSingle
      const { data: existingPipelineContact } = await supabase
        .from('pipeline_contacts')
        .select('id')
        .eq('contact_id', contactId)
        .eq('pipeline_id', mapping.pipeline_id)
        .eq('stage_id', mapping.stage_id)
        .maybeSingle();

      if (!existingPipelineContact) {
        const { error: pipelineError } = await supabase
          .from('pipeline_contacts')
          .insert({
            contact_id: contactId,
            pipeline_id: mapping.pipeline_id,
            stage_id: mapping.stage_id,
            source_type: 'planning_center',
            source_id: mapping.external_list_id,
          });
          
        if (pipelineError) {
          console.error('Error adding to pipeline:', pipelineError);
        } else {
          console.log('Successfully added contact to pipeline');
        }
      } else {
        console.log('Contact already in pipeline stage');
      }
    }
  }

  console.log('Sync completed:', { contactsAdded, contactsUpdated, totalPeople: people.length });

  return {
    listId: mapping.external_list_id,
    success: true,
    contactsAdded,
    contactsUpdated,
    totalPeople: people.length,
  };
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
        // Temporarily bypass frequency check for testing
        const shouldSync = true; // shouldSyncNow(mapping.last_sync_at, syncFrequency);
        if (!shouldSync) {
          console.log(`Skipping sync for mapping ${mapping.id} - frequency not reached (${syncFrequency})`);
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
          
      } catch (error) {
        console.error(`Error auto-syncing mapping ${mapping.id}:`, error);
        results.push({
          listId: mapping.external_list_id,
          success: false,
          error: error.message,
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
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

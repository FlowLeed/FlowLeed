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
    
    // Update integration status to active
    await supabase
      .from('integrations')
      .update({ status: 'active' })
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
    throw new Error(`PC API error: ${response.status}`);
  }

  const data = await response.json();
  const people = data.included?.filter((item: any) => item.type === 'Person') || [];

  let contactsAdded = 0;
  let contactsUpdated = 0;

  for (const person of people) {
    const personId = person.id;
    const attrs = person.attributes;

    // Check if contact already exists
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('pc_person_id', personId)
      .eq('organization_id', integration.organization_id)
      .single();

    const contactData = {
      name: `${attrs.first_name || ''} ${attrs.last_name || ''}`.trim() || 'Unknown',
      email: attrs.primary_email,
      phone: attrs.primary_phone_number,
      pc_person_id: personId,
      source_type: 'planning_center',
      last_synced_at: new Date().toISOString(),
      organization_id: integration.organization_id,
    };

    let contactId;

    if (existingContact) {
      // Update existing contact
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
      const { data: newContact } = await supabase
        .from('contacts')
        .insert(contactData)
        .select('id')
        .single();
      
      contactId = newContact?.id;
      contactsAdded++;
    }

    if (contactId) {
      // Add to pipeline stage if not already there
      const { data: existingPipelineContact } = await supabase
        .from('pipeline_contacts')
        .select('id')
        .eq('contact_id', contactId)
        .eq('pipeline_id', mapping.pipeline_id)
        .eq('stage_id', mapping.stage_id)
        .single();

      if (!existingPipelineContact) {
        await supabase
          .from('pipeline_contacts')
          .insert({
            contact_id: contactId,
            pipeline_id: mapping.pipeline_id,
            stage_id: mapping.stage_id,
            source_type: 'planning_center',
            source_id: mapping.external_list_id,
          });
      }
    }
  }

  return {
    listId: mapping.external_list_id,
    success: true,
    contactsAdded,
    contactsUpdated,
  };
}
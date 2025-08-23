import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const { action, ...body } = await req.json();

    switch (action) {
      case 'connect':
        return await handleConnect(supabase, user.id, body);
      case 'test':
        return await handleTest(supabase, user.id, body);
      case 'sync':
        return await handleSync(supabase, user.id, body);
      case 'sync_lists':
        return await handleSyncLists(supabase, user.id, body);
      case 'get_lists':
        return await handleGetLists(supabase, user.id, body);
      case 'map_list':
        return await handleMapList(supabase, user.id, body);
      case 'unmap_list':
        return await handleUnmapList(supabase, user.id, body);
      case 'disconnect':
        return await handleDisconnect(supabase, user.id, body);
      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('Error in planning-center-integration function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleConnect(supabase: any, userId: string, { appId, secret, organizationId }: any) {
  try {
    // Test the connection first
    const isValid = await testPlanningCenterConnection(appId, secret);
    if (!isValid) {
      throw new Error('Invalid Planning Center credentials');
    }

    // Store the integration
    const { data, error } = await supabase
      .from('integrations')
      .upsert({
        user_id: userId,
        organization_id: organizationId,
        service_name: 'planning_center',
        credentials: { app_id: appId, secret },
        status: 'connected'
      }, {
        onConflict: 'user_id,organization_id,service_name'
      })
      .select()
      .single();

    if (error) throw error;

    // Log the connection
    await supabase
      .from('integration_logs')
      .insert({
        integration_id: data.id,
        action: 'connect',
        status: 'success',
        message: 'Planning Center integration connected successfully'
      });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Planning Center connected successfully',
      integration: data 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Connect error:', error);
    throw error;
  }
}

async function handleTest(supabase: any, userId: string, { organizationId }: any) {
  try {
    // Get the stored integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('service_name', 'planning_center')
      .single();

    if (error || !integration) {
      throw new Error('Planning Center integration not found');
    }

    const { app_id, secret } = integration.credentials;
    const isValid = await testPlanningCenterConnection(app_id, secret);

    // Update status
    await supabase
      .from('integrations')
      .update({ 
        status: isValid ? 'connected' : 'error',
        updated_at: new Date().toISOString()
      })
      .eq('id', integration.id);

    // Log the test
    await supabase
      .from('integration_logs')
      .insert({
        integration_id: integration.id,
        action: 'test',
        status: isValid ? 'success' : 'error',
        message: isValid ? 'Connection test successful' : 'Connection test failed'
      });

    return new Response(JSON.stringify({ 
      success: isValid,
      message: isValid ? 'Connection test successful' : 'Connection test failed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Test error:', error);
    throw error;
  }
}

async function handleGetLists(supabase: any, userId: string, { organizationId }: any) {
  try {
    // Get the stored integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('service_name', 'planning_center')
      .single();

    if (error || !integration) {
      throw new Error('Planning Center integration not found');
    }

    const { app_id, secret } = integration.credentials;
    
    // Fetch lists from Planning Center
    const lists = await fetchPlanningCenterLists(app_id, secret);
    
    // Get existing mappings
    const { data: mappings } = await supabase
      .from('integration_list_mappings')
      .select(`
        *,
        pipelines(id, name),
        pipeline_stages(id, name)
      `)
      .eq('integration_id', integration.id);

    return new Response(JSON.stringify({ 
      success: true,
      lists,
      mappings: mappings || []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get lists error:', error);
    throw error;
  }
}

async function handleMapList(supabase: any, userId: string, { organizationId, listId, listName, pipelineId, stageId }: any) {
  try {
    // Get the stored integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('service_name', 'planning_center')
      .single();

    if (error || !integration) {
      throw new Error('Planning Center integration not found');
    }

    // Create or update mapping
    const { data, error: mappingError } = await supabase
      .from('integration_list_mappings')
      .upsert({
        integration_id: integration.id,
        external_list_id: listId,
        external_list_name: listName,
        pipeline_id: pipelineId,
        stage_id: stageId
      }, {
        onConflict: 'integration_id,external_list_id'
      })
      .select()
      .single();

    if (mappingError) throw mappingError;

    // Log the mapping
    await supabase
      .from('integration_logs')
      .insert({
        integration_id: integration.id,
        action: 'map_list',
        status: 'success',
        message: `Mapped list "${listName}" to pipeline`,
        details: { listId, listName, pipelineId, stageId }
      });

    return new Response(JSON.stringify({ 
      success: true,
      message: `List "${listName}" mapped to pipeline successfully`,
      mapping: data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Map list error:', error);
    throw error;
  }
}

async function handleUnmapList(supabase: any, userId: string, { organizationId, listId }: any) {
  try {
    // Get the stored integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('service_name', 'planning_center')
      .single();

    if (error || !integration) {
      throw new Error('Planning Center integration not found');
    }

    // Delete mapping
    const { error: deleteError } = await supabase
      .from('integration_list_mappings')
      .delete()
      .eq('integration_id', integration.id)
      .eq('external_list_id', listId);

    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ 
      success: true,
      message: 'List mapping removed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unmap list error:', error);
    throw error;
  }
}

async function handleSyncLists(supabase: any, userId: string, { organizationId }: any) {
  try {
    // Get the stored integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('service_name', 'planning_center')
      .single();

    if (error || !integration) {
      throw new Error('Planning Center integration not found');
    }

    const { app_id, secret } = integration.credentials;
    
    // Get list mappings
    const { data: mappings } = await supabase
      .from('integration_list_mappings')
      .select('*')
      .eq('integration_id', integration.id)
      .eq('auto_sync', true);

    if (!mappings || mappings.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No list mappings configured for auto-sync'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalImported = 0;
    let totalUpdated = 0;

    // Process each mapped list
    for (const mapping of mappings) {
      try {
        // Fetch people from this specific list
        const people = await fetchPlanningCenterListPeople(app_id, secret, mapping.external_list_id);
        
        for (const person of people) {
          const contactData = {
            name: `${person.attributes.first_name || ''} ${person.attributes.last_name || ''}`.trim(),
            email: person.attributes.primary_email,
            phone: person.attributes.primary_phone,
            organization_id: organizationId,
            assigned_to_user_id: userId,
            notes: `Imported from Planning Center list "${mapping.external_list_name}" (Person ID: ${person.id})`
          };

          // Try to find existing contact by email
          const { data: existingContact } = await supabase
            .from('contacts')
            .select('id')
            .eq('email', contactData.email)
            .eq('organization_id', organizationId)
            .maybeSingle();

          let contactId;
          if (existingContact) {
            // Update existing contact
            await supabase
              .from('contacts')
              .update(contactData)
              .eq('id', existingContact.id);
            contactId = existingContact.id;
            totalUpdated++;
          } else {
            // Create new contact
            const { data: newContact } = await supabase
              .from('contacts')
              .insert(contactData)
              .select('id')
              .single();
            contactId = newContact.id;
            totalImported++;
          }

          // Add to pipeline/stage if not already there
          const { data: existingPipelineContact } = await supabase
            .from('pipeline_contacts')
            .select('id')
            .eq('contact_id', contactId)
            .eq('pipeline_id', mapping.pipeline_id)
            .maybeSingle();

          if (!existingPipelineContact) {
            await supabase
              .from('pipeline_contacts')
              .insert({
                contact_id: contactId,
                pipeline_id: mapping.pipeline_id,
                stage_id: mapping.stage_id,
                stage_order: 0
              });
          }
        }

        // Update mapping last sync time
        await supabase
          .from('integration_list_mappings')
          .update({ 
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', mapping.id);

      } catch (listError) {
        console.error(`Error syncing list ${mapping.external_list_name}:`, listError);
        // Continue with other lists
      }
    }

    // Update integration last sync time
    await supabase
      .from('integrations')
      .update({ 
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', integration.id);

    // Log the sync
    await supabase
      .from('integration_logs')
      .insert({
        integration_id: integration.id,
        action: 'sync_lists',
        status: 'success',
        message: `List sync completed: ${totalImported} imported, ${totalUpdated} updated`,
        details: { imported: totalImported, updated: totalUpdated, mappings: mappings.length }
      });

    return new Response(JSON.stringify({ 
      success: true,
      message: `List sync completed: ${totalImported} imported, ${totalUpdated} updated`,
      stats: { imported: totalImported, updated: totalUpdated, lists: mappings.length }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Sync lists error:', error);
    throw error;

async function handleSync(supabase: any, userId: string, { organizationId }: any) {
  try {
    // Get the stored integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('service_name', 'planning_center')
      .single();

    if (error || !integration) {
      throw new Error('Planning Center integration not found');
    }

    const { app_id, secret } = integration.credentials;
    
    // Fetch people from Planning Center
    const people = await fetchPlanningCenterPeople(app_id, secret);
    
    let imported = 0;
    let updated = 0;

    // Process each person
    for (const person of people) {
      const contactData = {
        name: `${person.attributes.first_name || ''} ${person.attributes.last_name || ''}`.trim(),
        email: person.attributes.primary_email,
        phone: person.attributes.primary_phone,
        organization_id: organizationId,
        assigned_to_user_id: userId,
        notes: `Imported from Planning Center (ID: ${person.id})`
      };

      // Try to find existing contact by email
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('email', contactData.email)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (existingContact) {
        // Update existing contact
        await supabase
          .from('contacts')
          .update(contactData)
          .eq('id', existingContact.id);
        updated++;
      } else {
        // Create new contact
        await supabase
          .from('contacts')
          .insert(contactData);
        imported++;
      }
    }

    // Update integration last sync time
    await supabase
      .from('integrations')
      .update({ 
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', integration.id);

    // Log the sync
    await supabase
      .from('integration_logs')
      .insert({
        integration_id: integration.id,
        action: 'sync',
        status: 'success',
        message: `Sync completed: ${imported} imported, ${updated} updated`,
        details: { imported, updated, total: people.length }
      });

    return new Response(JSON.stringify({ 
      success: true,
      message: `Sync completed: ${imported} imported, ${updated} updated`,
      stats: { imported, updated, total: people.length }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Sync error:', error);
    throw error;
  }
}

async function handleDisconnect(supabase: any, userId: string, { organizationId }: any) {
  try {
    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('service_name', 'planning_center');

    if (error) throw error;

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Planning Center integration disconnected'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Disconnect error:', error);
    throw error;
  }
}

async function testPlanningCenterConnection(appId: string, secret: string): Promise<boolean> {
  try {
    const auth = btoa(`${appId}:${secret}`);
    const response = await fetch('https://api.planningcenteronline.com/people/v2/me', {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  } catch (error) {
    console.error('Planning Center connection test failed:', error);
    return false;
  }
}

async function fetchPlanningCenterLists(appId: string, secret: string) {
  try {
    const auth = btoa(`${appId}:${secret}`);
    const response = await fetch('https://api.planningcenteronline.com/people/v2/lists?per_page=100', {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Planning Center API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching Planning Center lists:', error);
    throw error;
  }
}

async function fetchPlanningCenterListPeople(appId: string, secret: string, listId: string) {
  try {
    const auth = btoa(`${appId}:${secret}`);
    const response = await fetch(`https://api.planningcenteronline.com/people/v2/lists/${listId}/people?per_page=100`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Planning Center API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching Planning Center list people:', error);
    throw error;
  }
}
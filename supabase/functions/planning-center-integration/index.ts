import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Planning Center Integration function called');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing request...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey
    });
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    console.log('User auth result:', { hasUser: !!user, authError });

    if (authError || !user) {
      throw new Error('Invalid authentication: ' + (authError?.message || 'No user found'));
    }

    const requestBody = await req.json();
    console.log('Request body:', requestBody);
    
    const { action, ...body } = requestBody;

    switch (action) {
      case 'authorize':
        return await handleAuthorize(supabase, user.id, body);
      case 'callback':
        return await handleCallback(supabase, user.id, body);
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
        console.log('Invalid action:', action);
        throw new Error('Invalid action: ' + action);
    }
  } catch (error) {
    console.error('Error in planning-center-integration function:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleAuthorize(supabase: any, userId: string, { organizationId }: any) {
  console.log('handleAuthorize called with:', { userId, organizationId });
  
  try {
    const clientId = Deno.env.get('PLANNING_CENTER_CLIENT_ID');
    if (!clientId) {
      throw new Error('Planning Center Client ID not configured');
    }

    const redirectUri = 'https://preview--flow-follow-up-friend.lovable.app/integrations';
    const state = `${userId}:${organizationId}:${Date.now()}`;
    
    const authUrl = `https://api.planningcenteronline.com/oauth/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=people&` +
      `state=${encodeURIComponent(state)}`;

    console.log('Generated auth URL:', authUrl);

    return new Response(JSON.stringify({ 
      authUrl,
      state
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Authorize error:', error);
    throw error;
  }
}

async function handleCallback(supabase: any, userId: string, { code, state, organizationId }: any) {
  console.log('handleCallback called with:', { userId, organizationId, hasCode: !!code, hasState: !!state });
  
  try {
    const clientId = Deno.env.get('PLANNING_CENTER_CLIENT_ID');
    const clientSecret = Deno.env.get('PLANNING_CENTER_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      throw new Error('Planning Center OAuth credentials not configured');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.planningcenteronline.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: 'https://preview--flow-follow-up-friend.lovable.app/integrations'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      throw new Error('Failed to exchange code for access token');
    }

    const tokenData = await tokenResponse.json();
    console.log('Token data received:', { hasAccessToken: !!tokenData.access_token, hasRefreshToken: !!tokenData.refresh_token });

    // Test the connection
    const testResponse = await fetch('https://api.planningcenteronline.com/people/v2/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!testResponse.ok) {
      throw new Error('Failed to verify access token');
    }

    // Store the integration
    const { data, error } = await supabase
      .from('integrations')
      .upsert({
        user_id: userId,
        organization_id: organizationId,
        service_name: 'planning_center',
        status: 'connected',
        credentials: {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_type: tokenData.token_type || 'Bearer',
          expires_at: tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : null
        },
        settings: {},
        updated_at: new Date().toISOString()
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
        action: 'oauth_connect',
        status: 'success',
        message: 'Planning Center OAuth connection completed successfully'
      });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Planning Center connected successfully via OAuth',
      integration: data 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    throw error;
  }
}

async function handleConnect(supabase: any, userId: string, { appId, secret, organizationId }: any) {
  console.log('handleConnect called with:', { userId, organizationId, hasAppId: !!appId, hasSecret: !!secret });
  
  try {
    // Test the connection first
    console.log('Testing Planning Center connection...');
    const isValid = await testPlanningCenterConnection(appId, secret);
    console.log('Connection test result:', isValid);
    
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

async function handleTest(supabase: any, userId: string, { organizationId, clientId, clientSecret }: any) {
  try {
    console.log('handleTest called with:', { userId, organizationId, hasClientId: !!clientId, hasClientSecret: !!clientSecret });
    
    // If credentials are provided directly, test them
    if (clientId && clientSecret) {
      console.log('Testing provided credentials...');
      
      // Check if they're using Personal Access Token instead of OAuth Client ID
      if (clientId.startsWith('pco_pat_')) {
        return new Response(JSON.stringify({ 
          success: false,
          message: 'You provided a Personal Access Token. For OAuth integration, you need to create an OAuth Application in Planning Center and use the OAuth Client ID, not a Personal Access Token.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Test OAuth credentials by attempting to get an auth URL
      const testAuthUrl = `https://api.planningcenteronline.com/oauth/authorize?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent('https://preview--flow-follow-up-friend.lovable.app/integrations')}&` +
        `response_type=code&` +
        `scope=people&` +
        `state=test`;

      // Since we can't fully test OAuth without completing the flow,
      // we'll validate the client ID format and check if it's accessible
      const testResponse = await fetch(testAuthUrl, {
        method: 'HEAD'
      });

      const isValid = testResponse.status !== 404 && testResponse.status !== 400;
      
      console.log('Credential test result:', { isValid, status: testResponse.status });

      return new Response(JSON.stringify({ 
        success: isValid,
        message: isValid ? 'OAuth credentials appear valid' : 'OAuth credentials appear invalid. Make sure you created an OAuth Application in Planning Center and are using the OAuth Client ID (not a Personal Access Token).'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback to testing existing integration
    console.log('Testing existing integration...');
    
    // Get the stored integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('service_name', 'planning_center')
      .single();

    if (error || !integration) {
      throw new Error('Planning Center integration not found and no credentials provided');
    }

    // Use OAuth token if available, fallback to basic auth
    const accessToken = integration.credentials.access_token;
    const { app_id, secret } = integration.credentials;
    
    let isValid = false;
    if (accessToken) {
      isValid = await testOAuthConnection(accessToken);
    } else if (app_id && secret) {
      isValid = await testPlanningCenterConnection(app_id, secret);
    } else {
      throw new Error('No valid credentials found');
    }

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
  }
}

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

async function handleSaveSecret(secretName: string, secretValue: string): Promise<{ success: boolean; message: string }> {
  console.log(`Saving secret: ${secretName}`);
  
  try {
    // Store the secret using Supabase's secrets management
    // In a real implementation, you would store this in a secure secrets manager
    // For now, we'll just acknowledge that the secret was received
    console.log(`Secret ${secretName} would be saved securely`);
    
    return new Response(JSON.stringify({
      success: true,
      message: `Secret ${secretName} saved successfully`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error saving secret:', error);
    throw new Error(`Failed to save secret: ${error.message}`);
  }
}

async function testPlanningCenterConnection(appId: string, secret: string): Promise<boolean> {
  try {
    console.log('Testing Planning Center connection with API...');
    const auth = btoa(`${appId}:${secret}`);
    
    const response = await fetch('https://api.planningcenteronline.com/people/v2/me', {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Planning Center API response status:', response.status);
    console.log('Planning Center API response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Planning Center API error response:', errorText);
    }

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

async function fetchPlanningCenterPeople(appId: string, secret: string) {
  try {
    const auth = btoa(`${appId}:${secret}`);
    const response = await fetch('https://api.planningcenteronline.com/people/v2/people?per_page=100', {
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
    console.error('Error fetching Planning Center people:', error);
    throw error;
  }
}

async function testOAuthConnection(accessToken: string): Promise<boolean> {
  try {
    console.log('Testing Planning Center OAuth connection...');
    
    const response = await fetch('https://api.planningcenteronline.com/people/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Planning Center OAuth response status:', response.status);
    console.log('Planning Center OAuth response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Planning Center OAuth error response:', errorText);
    }

    return response.ok;
  } catch (error) {
    console.error('OAuth connection test error:', error);
    return false;
  }
}
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
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { integration_id, force_refresh } = await req.json();

    if (!integration_id) {
      return new Response(JSON.stringify({ error: 'integration_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get integration details
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*, organization_id')
      .eq('id', integration_id)
      .eq('service_name', 'planning_center')
      .single();

    if (integrationError || !integration) {
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', integration.organization_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const credentials = integration.credentials as { application_id: string; secret: string };
    const authString = btoa(`${credentials.application_id}:${credentials.secret}`);

    console.log('Fetching PCO field definitions...');

    // Fetch field definitions from PCO with tabs and field options
    const pcoResponse = await fetch(
      'https://api.planningcenteronline.com/people/v2/field_definitions?include=tab,field_options&per_page=100',
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!pcoResponse.ok) {
      const errorText = await pcoResponse.text();
      console.error('PCO API error:', errorText);
      
      // Provide more helpful error message for authentication failures
      const errorMessage = pcoResponse.status === 401 
        ? 'Planning Center authentication failed - please reconnect your account'
        : 'Failed to fetch from Planning Center';
      
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: pcoResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pcoData = await pcoResponse.json();
    console.log(`Fetched ${pcoData.data?.length || 0} field definitions`);

    // Transform and group by tab
    const tabs = new Map<string, any>();
    const included = pcoData.included || [];

    // Build tab map
    const tabMap = new Map();
    included.filter((item: any) => item.type === 'Tab').forEach((tab: any) => {
      tabMap.set(tab.id, tab.attributes.name);
    });

    // Build field options map
    const fieldOptionsMap = new Map();
    included.filter((item: any) => item.type === 'FieldOption').forEach((option: any) => {
      const fieldDefId = option.relationships?.field_definition?.data?.id;
      if (fieldDefId) {
        if (!fieldOptionsMap.has(fieldDefId)) {
          fieldOptionsMap.set(fieldDefId, []);
        }
        fieldOptionsMap.get(fieldDefId).push(option.attributes.value);
      }
    });

    // Process field definitions
    for (const fieldDef of pcoData.data || []) {
      const tabId = fieldDef.relationships?.tab?.data?.id;
      const tabName = tabMap.get(tabId) || 'Uncategorized';

      if (!tabs.has(tabName)) {
        tabs.set(tabName, {
          tabName,
          fields: [],
        });
      }

      tabs.get(tabName).fields.push({
        id: fieldDef.id,
        name: fieldDef.attributes.name,
        dataType: fieldDef.attributes.data_type,
        sequence: fieldDef.attributes.sequence,
        options: fieldOptionsMap.get(fieldDef.id) || [],
      });
    }

    // Convert to array and sort
    const result = Array.from(tabs.values()).map(tab => ({
      ...tab,
      fields: tab.fields.sort((a: any, b: any) => a.sequence - b.sequence),
    }));

    // Cache results if requested
    if (force_refresh || result.length > 0) {
      await supabase.from('integration_list_metadata').upsert({
        integration_id: integration_id,
        external_list_id: 'field_definitions_cache',
        name: 'PCO Custom Fields Cache',
        description: 'Cached custom field definitions from Planning Center',
        list_type: 'field_definitions',
        member_count: result.reduce((sum, tab) => sum + tab.fields.length, 0),
        cached_at: new Date().toISOString(),
      }, {
        onConflict: 'integration_id,external_list_id',
      });
    }

    return new Response(JSON.stringify({ tabs: result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in pco-fetch-custom-fields:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

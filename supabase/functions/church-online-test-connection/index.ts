import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// GraphQL query to test connection - only use documented public queries
const TEST_QUERY = `
  query TestConnection {
    currentService(onEmpty: LOAD_NEXT) {
      id
      startTime
      endTime
      content {
        title
      }
    }
  }
`;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, subdomain, integrationId } = await req.json();

    if (!domain && !subdomain && !integrationId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing domain, subdomain, or integrationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let targetDomain = domain;

    // If subdomain provided (legacy), convert to full domain
    if (subdomain && !domain) {
      targetDomain = `${subdomain.replace(/\.online\.church$/i, '').trim()}.online.church`;
    }

    // If integrationId provided, get domain from integration
    if (integrationId && !targetDomain) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: integration, error } = await supabase
        .from('integrations')
        .select('settings')
        .eq('id', integrationId)
        .eq('service_name', 'church_online')
        .single();

      if (error || !integration) {
        return new Response(
          JSON.stringify({ success: false, error: 'Integration not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const settings = integration.settings as { domain?: string; subdomain?: string };
      // Support both new domain format and legacy subdomain format
      targetDomain = settings?.domain || (settings?.subdomain ? `${settings.subdomain}.online.church` : null);
    }

    if (!targetDomain) {
      return new Response(
        JSON.stringify({ success: false, error: 'No domain configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean domain (remove https:// and trailing slashes)
    targetDomain = targetDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

    // Make GraphQL request to Church Online API
    const apiUrl = `https://${targetDomain}/graphql`;
    
    console.log('Testing connection to:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: TEST_QUERY,
        operationName: 'TestConnection'
      })
    });

    if (!response.ok) {
      console.error('GraphQL request failed:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to connect: ${response.status} ${response.statusText}` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.errors[0]?.message || 'GraphQL query failed' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Connection successful:', data.data);

    const currentService = data.data?.currentService;
    const serviceName = currentService?.content?.title || 'Church Online Platform';

    return new Response(
      JSON.stringify({ 
        success: true, 
        organization: { name: serviceName },
        currentService: currentService,
        domain: targetDomain
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Test connection error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to test connection' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

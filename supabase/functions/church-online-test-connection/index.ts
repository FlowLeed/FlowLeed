import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// GraphQL query to test connection and get current service info
const TEST_QUERY = `
  query TestConnection {
    currentService {
      id
      title
      startTime
      endTime
    }
    organization {
      id
      name
    }
  }
`;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subdomain, integrationId } = await req.json();

    if (!subdomain && !integrationId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing subdomain or integrationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let targetSubdomain = subdomain;

    // If integrationId provided, get subdomain from integration
    if (integrationId && !subdomain) {
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

      const settings = integration.settings as { subdomain?: string };
      targetSubdomain = settings?.subdomain;
    }

    if (!targetSubdomain) {
      return new Response(
        JSON.stringify({ success: false, error: 'No subdomain configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean subdomain (remove any trailing .online.church if included)
    targetSubdomain = targetSubdomain.replace(/\.online\.church$/i, '').trim();

    // Make GraphQL request to Church Online API
    const apiUrl = `https://${targetSubdomain}.online.church/graphql`;
    
    console.log('Testing connection to:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: TEST_QUERY
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        organization: data.data?.organization,
        currentService: data.data?.currentService,
        subdomain: targetSubdomain
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

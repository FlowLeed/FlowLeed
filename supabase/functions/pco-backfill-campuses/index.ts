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
    const { integrationId, cursor } = await req.json();

    // Get integration credentials
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('credentials, organization_id')
      .eq('id', integrationId)
      .single();

    if (intError || !integration) {
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const creds = integration.credentials as any;
    const auth = btoa(`${creds.application_id}:${creds.secret}`);
    const orgId = integration.organization_id;

    // Load campus map
    const { data: campuses } = await supabase
      .from('campuses')
      .select('id, pco_campus_id')
      .eq('organization_id', orgId);

    const campusMap = new Map<string, string>();
    campuses?.forEach(c => campusMap.set(c.pco_campus_id, c.id));

    if (campusMap.size === 0) {
      return new Response(JSON.stringify({ error: 'No campuses found. Run sync first.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch people from PCO with minimal fields (just need primary_campus)
    // Process up to 30 pages per invocation to stay within wall time
    let nextUrl: string | null = cursor || 
      'https://api.planningcenteronline.com/people/v2/people?per_page=100&where[status]=active';
    let pageCount = 0;
    let updatedCount = 0;
    const MAX_PAGES = 30;

    while (nextUrl && pageCount < MAX_PAGES) {
      pageCount++;
      
      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: `PCO API error: ${response.status}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      const people = data.data || [];
      
      // Batch update contacts with campus assignments
      for (const person of people) {
        const pcoCampusId = person.relationships?.primary_campus?.data?.id;
        if (!pcoCampusId) continue;

        const campusId = campusMap.get(String(pcoCampusId));
        if (!campusId) continue;

        const pcPersonId = person.id;
        
        // Update contact by pc_person_id
        const { error: updateError } = await supabase
          .from('contacts')
          .update({ campus_id: campusId })
          .eq('organization_id', orgId)
          .eq('pc_person_id', pcPersonId)
          .is('campus_id', null); // Only update if not already set

        if (!updateError) {
          updatedCount++;
        }
      }

      nextUrl = data.links?.next || null;
      console.log(`Page ${pageCount}: processed ${people.length} people, ${updatedCount} campus assignments so far`);
    }

    return new Response(JSON.stringify({
      success: true,
      pagesProcessed: pageCount,
      updatedCount,
      nextCursor: nextUrl, // null if done
      done: !nextUrl,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

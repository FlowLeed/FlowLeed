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

    const { data: campuses } = await supabase
      .from('campuses')
      .select('id, pco_campus_id')
      .eq('organization_id', orgId);

    const campusMap = new Map<string, string>();
    campuses?.forEach(c => campusMap.set(c.pco_campus_id, c.id));

    if (campusMap.size === 0) {
      return new Response(JSON.stringify({ error: 'No campuses found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Collect person→campus mappings grouped by campus
    const campusAssignments = new Map<string, string[]>(); // campusId → [pcPersonIds]
    
    let nextUrl: string | null = cursor || 
      'https://api.planningcenteronline.com/people/v2/people?per_page=100&where[status]=active';
    let pageCount = 0;
    const MAX_PAGES = 50;

    while (nextUrl && pageCount < MAX_PAGES) {
      pageCount++;
      
      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`PCO API error: ${response.status}`);
        break;
      }

      const data = await response.json();
      const people = data.data || [];
      
      for (const person of people) {
        const pcoCampusId = person.relationships?.primary_campus?.data?.id;
        if (!pcoCampusId) continue;
        const campusId = campusMap.get(String(pcoCampusId));
        if (!campusId) continue;
        
        if (!campusAssignments.has(campusId)) {
          campusAssignments.set(campusId, []);
        }
        campusAssignments.get(campusId)!.push(String(person.id));
      }

      nextUrl = data.links?.next || null;
      console.log(`Page ${pageCount}: ${people.length} people, collected ${[...campusAssignments.values()].reduce((s, a) => s + a.length, 0)} assignments`);
    }

    // Batch update contacts by campus (one UPDATE per campus)
    let totalUpdated = 0;
    for (const [campusId, pcPersonIds] of campusAssignments) {
      // Update in batches of 500 to avoid query size limits
      for (let i = 0; i < pcPersonIds.length; i += 500) {
        const batch = pcPersonIds.slice(i, i + 500);
        const { count, error } = await supabase
          .from('contacts')
          .update({ campus_id: campusId })
          .eq('organization_id', orgId)
          .in('pc_person_id', batch);
        
        if (error) {
          console.error(`Error updating campus ${campusId}:`, error);
        } else {
          totalUpdated += count || 0;
          console.log(`Updated ${count} contacts for campus ${campusId}`);
        }
      }
    }

    // Reset last_full_sync_completed_at if we're done
    if (!nextUrl) {
      await supabase
        .from('integrations')
        .update({ last_full_sync_completed_at: new Date().toISOString() })
        .eq('id', integrationId);
    }

    return new Response(JSON.stringify({
      success: true,
      pagesProcessed: pageCount,
      totalUpdated,
      nextCursor: nextUrl,
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

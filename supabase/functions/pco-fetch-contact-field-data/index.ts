import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PcoField {
  id: string;
  name: string;
  dataType: string;
  sequence: number;
  tabName: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { contact_id } = await req.json();
    if (!contact_id) {
      return new Response(JSON.stringify({ error: 'contact_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load contact + verify org membership
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, pc_person_id, organization_id')
      .eq('id', contact_id)
      .single();

    if (!contact) {
      return new Response(JSON.stringify({ error: 'Contact not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', contact.organization_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get PCO integration for this org
    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials')
      .eq('organization_id', contact.organization_id)
      .eq('service_name', 'planning_center')
      .eq('is_active', true)
      .maybeSingle();

    if (!integration) {
      return new Response(JSON.stringify({ fields: [], tabs: [], values: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const creds = integration.credentials as { application_id: string; secret: string };
    const authString = btoa(`${creds.application_id}:${creds.secret}`);
    const pcoHeaders = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
    };

    // Fetch field definitions (with tabs) + contact values in parallel
    const [defsRes, valuesRes] = await Promise.all([
      fetch('https://api.planningcenteronline.com/people/v2/field_definitions?include=tab&per_page=100', { headers: pcoHeaders }),
      contact.pc_person_id
        ? fetch(`https://api.planningcenteronline.com/people/v2/people/${contact.pc_person_id}/field_data?per_page=100`, { headers: pcoHeaders })
        : Promise.resolve(null),
    ]);

    if (!defsRes.ok) {
      const err = await defsRes.text();
      console.error('PCO defs error', err);
      return new Response(JSON.stringify({ error: 'Failed to fetch PCO field definitions' }), {
        status: defsRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const defsData = await defsRes.json();
    const tabMap = new Map<string, string>();
    for (const inc of defsData.included || []) {
      if (inc.type === 'Tab') tabMap.set(inc.id, inc.attributes?.name || 'Other');
    }

    const fields: PcoField[] = (defsData.data || [])
      .filter((f: any) => !f.attributes?.deleted_at)
      .map((f: any) => ({
        id: f.id,
        name: f.attributes?.name || 'Unnamed',
        dataType: f.attributes?.data_type || 'string',
        sequence: f.attributes?.sequence ?? 0,
        tabName: tabMap.get(f.relationships?.tab?.data?.id) || 'Other',
      }));

    // Group by tab
    const tabGroups = new Map<string, PcoField[]>();
    for (const f of fields) {
      if (!tabGroups.has(f.tabName)) tabGroups.set(f.tabName, []);
      tabGroups.get(f.tabName)!.push(f);
    }
    const tabs = Array.from(tabGroups.entries()).map(([tabName, flds]) => ({
      tabName,
      fields: flds.sort((a, b) => a.sequence - b.sequence),
    }));

    // Parse contact values
    const values: Record<string, string> = {};
    if (valuesRes && valuesRes.ok) {
      const valData = await valuesRes.json();
      for (const v of valData.data || []) {
        const defId = v.relationships?.field_definition?.data?.id;
        if (defId) values[defId] = v.attributes?.value ?? '';
      }
    }

    return new Response(JSON.stringify({ fields, tabs, values }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

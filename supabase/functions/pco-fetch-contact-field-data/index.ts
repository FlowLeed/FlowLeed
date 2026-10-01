import { createClient } from '@supabase/supabase-js';
import { getPcoAuthHeader } from '../_shared/pco-auth.ts';

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
      .select('id')
      .eq('organization_id', contact.organization_id)
      .eq('service_name', 'planning_center')
      .maybeSingle();

    if (!integration) {
      return new Response(JSON.stringify({ fields: [], tabs: [], values: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { header: pcoAuthHeader } = await getPcoAuthHeader(supabase, integration.id);
    const pcoHeaders = {
      'Authorization': pcoAuthHeader,
      'Content-Type': 'application/json',
    };

    // Paginated fetch helper
    async function fetchAll(
      initialUrl: string,
      opts: { tolerate404?: boolean } = {}
    ): Promise<{ data: any[]; included: any[]; missing?: boolean }> {
      let url: string | null = initialUrl;
      const allData: any[] = [];
      const allIncluded: any[] = [];
      let guard = 0;
      while (url && guard < 50) {
        const res: Response = await fetch(url, { headers: pcoHeaders });
        if (!res.ok) {
          const err = await res.text();
          console.error('PCO fetch error', url, err);
          if (res.status === 404 && opts.tolerate404) {
            return { data: allData, included: allIncluded, missing: true };
          }
          throw new Error(`PCO fetch failed: ${res.status}`);
        }
        const json: any = await res.json();
        if (Array.isArray(json.data)) allData.push(...json.data);
        if (Array.isArray(json.included)) allIncluded.push(...json.included);
        url = json.links?.next || null;
        guard++;
      }
      return { data: allData, included: allIncluded };
    }

    const [defsAll, valuesAll] = await Promise.all([
      fetchAll('https://api.planningcenteronline.com/people/v2/field_definitions?include=tab&per_page=100'),
      contact.pc_person_id
        ? fetchAll(
            `https://api.planningcenteronline.com/people/v2/people/${contact.pc_person_id}/field_data?per_page=100`,
            { tolerate404: true }
          )
        : Promise.resolve({ data: [], included: [], missing: !contact.pc_person_id }),
    ]);


    const tabMap = new Map<string, string>();
    for (const inc of defsAll.included) {
      if (inc.type === 'Tab') tabMap.set(inc.id, inc.attributes?.name || 'Other');
    }

    const fields: PcoField[] = defsAll.data
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
    for (const v of valuesAll.data) {
      const defId = v.relationships?.field_definition?.data?.id;
      if (defId) values[defId] = v.attributes?.value ?? '';
    }

    return new Response(
      JSON.stringify({
        fields,
        tabs,
        values,
        personMissing: !!contact.pc_person_id && !!(valuesAll as any).missing,
        notLinked: !contact.pc_person_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

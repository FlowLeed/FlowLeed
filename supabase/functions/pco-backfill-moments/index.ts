import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { corsHeaders } from '../_shared/cors.ts';

const BATCH_SIZE = 10; // Process contacts in batches to avoid timeout

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { integrationId, organizationId } = await req.json();

    console.log(`Starting backfill for org ${organizationId}, integration ${integrationId}`);

    // Get integration credentials
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('credentials')
      .eq('id', integrationId)
      .eq('organization_id', organizationId)
      .single();

    if (integrationError || !integration) {
      throw new Error('Integration not found');
    }

    const credentials = integration.credentials as { app_id: string; secret: string };
    const auth = `${credentials.app_id}:${credentials.secret}`;
    const authB64 = btoa(auth);

    // Fetch all active moment mappings
    const { data: mappings, error: mappingsError } = await supabase
      .from('pco_moment_mappings')
      .select('*, flow_moment_types(name, category, icon, color)')
      .eq('integration_id', integrationId)
      .eq('is_active', true);

    if (mappingsError) {
      throw new Error(`Failed to fetch mappings: ${mappingsError.message}`);
    }

    console.log(`Found ${mappings?.length || 0} active moment mappings`);

    // Fetch all contacts with PCO IDs
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, name, pc_person_id')
      .eq('organization_id', organizationId)
      .not('pc_person_id', 'is', null);

    if (contactsError) {
      throw new Error(`Failed to fetch contacts: ${contactsError.message}`);
    }

    console.log(`Found ${contacts?.length || 0} contacts to process`);

    let totalProcessed = 0;
    let totalMomentsCreated = 0;
    let totalErrors = 0;

    // Process contacts in batches
    for (let i = 0; i < (contacts?.length || 0); i += BATCH_SIZE) {
      const batch = contacts!.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(async (contact) => {
          try {
            const momentsCreated = await syncFlowMomentsForContact(
              contact.id,
              contact.pc_person_id!,
              organizationId,
              authB64,
              mappings || [],
              supabase
            );
            totalMomentsCreated += momentsCreated;
            totalProcessed++;
          } catch (error) {
            console.error(`Error processing contact ${contact.name} (${contact.pc_person_id}):`, error);
            totalErrors++;
          }
        })
      );
    }

    const result = {
      success: true,
      contactsProcessed: totalProcessed,
      momentsCreated: totalMomentsCreated,
      errors: totalErrors,
      totalContacts: contacts?.length || 0
    };

    console.log('Backfill complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function syncFlowMomentsForContact(
  contactId: string,
  pcPersonId: string,
  organizationId: string,
  authB64: string,
  mappings: any[],
  supabase: any
): Promise<number> {
  let momentsCreated = 0;

  // Fetch field_data from PCO
  const fieldDataUrl = `https://api.planningcenteronline.com/people/v2/people/${pcPersonId}/field_data`;
  const fieldDataResponse = await fetch(fieldDataUrl, {
    headers: { Authorization: `Basic ${authB64}` },
  });

  if (!fieldDataResponse.ok) {
    if (fieldDataResponse.status === 401) {
      throw new Error('PCO authentication failed');
    }
    console.log(`Failed to fetch field data for person ${pcPersonId}`);
    return 0;
  }

  const fieldDataJson = await fieldDataResponse.json();
  const fieldDataArray = fieldDataJson.data || [];

  if (fieldDataArray.length === 0) {
    return 0;
  }

  // Build a map of field_definition_id -> value
  const fieldDataMap = new Map();
  for (const item of fieldDataArray) {
    const fieldDefinitionId = item.relationships?.field_definition?.data?.id;
    const value = item.attributes?.value;
    if (fieldDefinitionId && value !== null && value !== undefined) {
      fieldDataMap.set(fieldDefinitionId, {
        value,
        created_at: item.attributes?.created_at,
        updated_at: item.attributes?.updated_at,
        attributes: item.attributes
      });
    }
  }

  // Check each mapping
  for (const mapping of mappings) {
    const fieldId = mapping.pco_source_identifier;
    const fieldData = fieldDataMap.get(fieldId);

    if (!fieldData) {
      continue;
    }

    const condition = mapping.trigger_condition || {};
    const operator = condition.operator || 'has_any_value';
    const expectedValue = condition.value;
    const actualValue = fieldData.value;

    let conditionMet = false;

    switch (operator) {
      case 'has_any_value':
        conditionMet = actualValue !== null && actualValue !== undefined && actualValue !== '';
        break;
      case 'equals':
        conditionMet = String(actualValue).toLowerCase() === String(expectedValue).toLowerCase();
        break;
      case 'contains':
        conditionMet = String(actualValue).toLowerCase().includes(String(expectedValue).toLowerCase());
        break;
      case 'is_true':
        conditionMet = actualValue === 'true' || actualValue === true || actualValue === 1;
        break;
      case 'is_checked':
        conditionMet = actualValue === 'true' || actualValue === true || actualValue === 1;
        break;
      default:
        conditionMet = false;
    }

    if (conditionMet) {
      // Determine occurred_at date
      let occurredAt = new Date().toISOString();
      const rawValue = String(actualValue);
      
      // Try to parse date from value
      if (rawValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [month, day, year] = rawValue.split('/');
        occurredAt = new Date(`${year}-${month}-${day}`).toISOString();
      } else if (rawValue.match(/^\d{4}-\d{2}-\d{2}/)) {
        occurredAt = new Date(rawValue).toISOString();
      } else if (fieldData.updated_at) {
        occurredAt = fieldData.updated_at;
      } else if (fieldData.created_at) {
        occurredAt = fieldData.created_at;
      }

      // Create or update the moment
      const sourceReference = `pco_field_${fieldId}_person_${pcPersonId}`;

      const { error: momentError } = await supabase
        .from('flow_moments')
        .upsert(
          {
            contact_id: contactId,
            flow_moment_type_id: mapping.flow_moment_type_id,
            source_system: 'pco',
            source_reference: sourceReference,
            occurred_at: occurredAt,
            metadata: {
              field_id: fieldId,
              field_label: mapping.pco_source_label,
              field_value: actualValue,
              pco_person_id: pcPersonId,
            },
          },
          { onConflict: 'contact_id,flow_moment_type_id,source_reference' }
        );

      if (momentError) {
        console.error(`Error creating moment for ${mapping.flow_moment_types?.name}:`, momentError);
      } else {
        momentsCreated++;
      }

      // Update mapping last_synced_at
      await supabase
        .from('pco_moment_mappings')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', mapping.id);
    }
  }

  return momentsCreated;
}

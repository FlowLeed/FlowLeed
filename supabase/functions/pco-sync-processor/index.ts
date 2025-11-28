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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing next pending chunks from queue...');

    // Fetch up to 100 pending chunks for round-robin selection
    const { data: chunks, error: chunkError } = await supabase
      .from('pco_sync_queue')
      .select(`
        *,
        pco_sync_jobs (
          *,
          integrations (
            id,
            organization_id,
            credentials
          ),
          integration_list_mappings (
            pipeline_id,
            stage_id
          )
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100);

    if (chunkError) {
      console.error('Error fetching chunks:', chunkError);
      return new Response(JSON.stringify({ error: chunkError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!chunks || chunks.length === 0) {
      console.log('No pending chunks found');
      return new Response(JSON.stringify({ message: 'No pending chunks' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Select up to 20 chunks using round-robin (one per organization)
    const selectedChunks = [];
    const seenOrgs = new Set();
    
    for (const chunk of chunks) {
      if (!seenOrgs.has(chunk.organization_id)) {
        selectedChunks.push(chunk);
        seenOrgs.add(chunk.organization_id);
        if (selectedChunks.length >= 20) break;
      }
    }

    console.log(`Processing ${selectedChunks.length} chunks from ${seenOrgs.size} organizations`);

    let successCount = 0;
    let errorCount = 0;
    const processedOrgs = new Set();

    // Process each selected chunk
    for (const chunk of selectedChunks) {
      try {
        console.log(`Processing chunk ${chunk.chunk_number} for job ${chunk.sync_job_id} (org: ${chunk.organization_id})`);
        processedOrgs.add(chunk.organization_id);

        // Mark chunk as processing
        await supabase
          .from('pco_sync_queue')
          .update({ status: 'processing' })
          .eq('id', chunk.id);

        const job = chunk.pco_sync_jobs;
        const integration = job.integrations;
        const mapping = job.integration_list_mappings;
        const people = chunk.chunk_data as any[];

        console.log(`Processing ${people.length} contacts in chunk ${chunk.chunk_number}`);

        // Get PC credentials (try application_id first, fallback to app_id for backwards compatibility)
        const applicationId = integration.credentials.application_id ?? integration.credentials.app_id;
        const secret = integration.credentials.secret;
        const auth = btoa(`${applicationId}:${secret}`);

        // Process each person in the chunk
        for (const person of people) {
          await processPersonData(person, integration.organization_id, mapping, auth, supabase);
        }

        // Mark chunk as completed
        await supabase
          .from('pco_sync_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString()
          })
          .eq('id', chunk.id);

        console.log(`Chunk ${chunk.chunk_number} completed successfully`);

        // Update job progress
        const { data: currentJob } = await supabase
          .from('pco_sync_jobs')
          .select('processed_contacts, total_contacts')
          .eq('id', chunk.sync_job_id)
          .single();

        if (currentJob) {
          const newProcessed = currentJob.processed_contacts + people.length;
          const isComplete = newProcessed >= currentJob.total_contacts;

          await supabase
            .from('pco_sync_jobs')
            .update({
              processed_contacts: newProcessed,
              status: isComplete ? 'completed' : 'processing',
              completed_at: isComplete ? new Date().toISOString() : null
            })
            .eq('id', chunk.sync_job_id);

          console.log(`Job progress: ${newProcessed}/${currentJob.total_contacts} contacts`);

          // Track PCO sync when job is complete
          if (isComplete) {
            await supabase.rpc('track_pco_sync', {
              p_org_id: integration.organization_id,
              p_sync_type: 'list_sync'
            });
            
            // Update mapping last_sync_at
            await supabase
              .from('integration_list_mappings')
              .update({ last_sync_at: new Date().toISOString() })
              .eq('id', job.list_mapping_id);
          }
        }

        successCount++;

      } catch (error) {
        console.error(`Error processing chunk ${chunk.id}:`, error);
        errorCount++;

        // Check retry count
        const currentRetryCount = chunk.retry_count || 0;

        if (currentRetryCount < 3) {
          // Mark for retry
          await supabase
            .from('pco_sync_queue')
            .update({
              status: 'pending',
              retry_count: currentRetryCount + 1,
              error_message: error.message
            })
            .eq('id', chunk.id);

          console.log(`Chunk ${chunk.chunk_number} marked for retry (attempt ${currentRetryCount + 1}/3)`);
        } else {
          // Max retries reached, mark as failed
          await supabase
            .from('pco_sync_queue')
            .update({
              status: 'failed',
              error_message: error.message
            })
            .eq('id', chunk.id);

          // Mark job as failed if this chunk failed
          const job = chunk.pco_sync_jobs;
          if (job) {
            await supabase
              .from('pco_sync_jobs')
              .update({
                status: 'failed',
                error_message: error.message
              })
              .eq('id', job.id);
          }

          console.error(`Chunk ${chunk.chunk_number} failed after 3 retries`);
        }
      }
    }

    return new Response(JSON.stringify({
      message: `Processed ${successCount} chunks successfully, ${errorCount} failed`,
      successCount,
      errorCount,
      organizations: processedOrgs.size,
      organizationIds: Array.from(processedOrgs)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Fatal error in processor:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Helper function to process a single person's data
async function processPersonData(
  person: any,
  organizationId: string,
  mapping: any,
  auth: string,
  supabase: any
) {
  const pcPersonId = person.id;
  const attributes = person.attributes;

  // Upsert contact - only include email/phone if we have actual values to avoid overwriting with null
  const contactData: any = {
    organization_id: organizationId,
    pc_person_id: pcPersonId,
    name: attributes.name || 'Unknown',
    avatar: attributes.avatar || null,
    source_type: 'planning_center',
    last_synced_at: new Date().toISOString(),
  };
  
  // Only set email/phone if we have actual values from the list response
  if (attributes.email_addresses?.[0]?.address) {
    contactData.email = attributes.email_addresses[0].address;
  }
  if (attributes.phone_numbers?.[0]?.number) {
    contactData.phone = attributes.phone_numbers[0].number;
  }

  console.log(`Syncing contact ${attributes.name} (PC ID: ${pcPersonId}):`, {
    email: contactData.email,
    phone: contactData.phone,
    has_campus: !!attributes.primary_campus_id
  });

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .upsert(contactData, {
      onConflict: 'organization_id,pc_person_id',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (contactError) {
    console.error('Error upserting contact:', contactError);
    throw contactError;
  }

  console.log(`Contact upserted: ${contact.name} (${contact.id})`);

  // Add to pipeline if not already in it
  const { data: existingPipelineContact } = await supabase
    .from('pipeline_contacts')
    .select('id')
    .eq('contact_id', contact.id)
    .eq('pipeline_id', mapping.pipeline_id)
    .single();

  if (!existingPipelineContact) {
    const { error: pipelineError } = await supabase
      .from('pipeline_contacts')
      .insert({
        contact_id: contact.id,
        pipeline_id: mapping.pipeline_id,
        stage_id: mapping.stage_id,
        source_type: 'planning_center',
        source_id: pcPersonId,
      });

    if (pipelineError) {
      console.error('Error adding contact to pipeline:', pipelineError);
    } else {
      console.log(`Added contact ${contact.name} to pipeline`);
    }
  }

  // Sync demographic data
  await syncDemographicData(contact.id, pcPersonId, auth, supabase);
  
  // Sync flow moments from custom field data
  await syncFlowMomentsFromFieldData(contact.id, organizationId, pcPersonId, auth, supabase);
}

// Helper function to sync demographic data from Planning Center
async function syncDemographicData(
  contactId: string,
  pcPersonId: string,
  auth: string,
  supabase: any
) {
  try {
    // Fetch person details with demographics
    const personResponse = await fetch(
      `https://api.planningcenteronline.com/people/v2/people/${pcPersonId}?include=addresses,households,field_data,phone_numbers,email_addresses`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!personResponse.ok) {
      // Handle authentication failures specifically
      if (personResponse.status === 401) {
        console.error(`Authentication failed for Planning Center API - credentials may be invalid`);
        
        // Get organization ID to update integration
        const { data: contact } = await supabase
          .from('contacts')
          .select('organization_id')
          .eq('id', contactId)
          .single();
        
        if (contact?.organization_id) {
          // Update integration status to failed
          const { error: updateError } = await supabase
            .from('integrations')
            .update({ 
              status: 'failed',
              metadata: {
                error: 'Authentication failed - please check your Planning Center credentials',
                last_error_at: new Date().toISOString()
              }
            })
            .eq('organization_id', contact.organization_id)
            .eq('service_name', 'planning_center');
          
          if (updateError) {
            console.error('Failed to update integration status:', updateError);
          }
        }
        
        throw new Error('Planning Center authentication failed - please reconnect your account');
      }
      
      console.error(`Failed to fetch person ${pcPersonId}: ${personResponse.statusText}`);
      return;
    }

    const personData = await personResponse.json();
    const person = personData.data;
    const included = personData.included || [];

    // Parse email addresses and phone numbers from included relationships
    const emails = included.filter((i: any) => i.type === 'EmailAddress');
    const phones = included.filter((i: any) => i.type === 'PhoneNumber');

    const primaryEmail = emails.find((e: any) => e.attributes?.primary) || emails[0];
    const primaryPhone = phones.find((p: any) => p.attributes?.primary) || phones[0];

    const detailedEmail = primaryEmail?.attributes?.address || null;
    const detailedPhone = primaryPhone?.attributes?.number || null;

    console.log(`Detailed API data for PC ID ${pcPersonId}:`, {
      emailsFound: emails.length,
      phonesFound: phones.length,
      selectedEmail: detailedEmail,
      selectedPhone: detailedPhone
    });

    // Update contact with more complete email/phone if available
    if (detailedEmail || detailedPhone) {
      const updateData: any = {
        last_synced_at: new Date().toISOString()
      };
      
      if (detailedEmail) updateData.email = detailedEmail;
      if (detailedPhone) updateData.phone = detailedPhone;

      const { error: updateError } = await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', contactId);

      if (updateError) {
        console.error('Error updating contact with detailed data:', updateError);
      } else {
        console.log(`Updated contact ${contactId} with email: ${detailedEmail}, phone: ${detailedPhone}`);
      }
    }

    // Sync demographics
    const demographicData: any = {};
    
    if (person.attributes.birthdate) {
      demographicData.birthday = person.attributes.birthdate;
    }
    if (person.attributes.gender) {
      demographicData.gender = person.attributes.gender;
    }
    if (person.attributes.marital_status) {
      demographicData.marital_status = person.attributes.marital_status;
    }

    // Look for occupation in field_data
    const fieldData = included.filter((item: any) => item.type === 'FieldDatum');
    const occupationField = fieldData.find((field: any) => 
      field.attributes?.field_definition_name?.toLowerCase().includes('occupation')
    );
    if (occupationField?.attributes?.value) {
      demographicData.occupation = occupationField.attributes.value;
    }

    if (Object.keys(demographicData).length > 0) {
      demographicData.contact_id = contactId;
      
      await supabase
        .from('contact_demographics')
        .upsert(demographicData, {
          onConflict: 'contact_id',
          ignoreDuplicates: false,
        });
    }

    // Sync addresses
    const addresses = included.filter((item: any) => item.type === 'Address');
    for (const address of addresses) {
      const addressData = {
        contact_id: contactId,
        street_address: address.attributes.street || null,
        city: address.attributes.city || null,
        state: address.attributes.state || null,
        zip_code: address.attributes.zip || null,
        address_type: address.attributes.location_type || 'home',
        is_primary: address.attributes.primary || false,
      };

      await supabase
        .from('contact_addresses')
        .upsert(addressData, {
          onConflict: 'contact_id,address_type',
          ignoreDuplicates: false,
        });
    }

    // Sync household/family members
    const households = included.filter((item: any) => item.type === 'Household');
    if (households.length > 0) {
      const householdId = households[0].id;
      
      // Fetch household members
      const membersResponse = await fetch(
        `https://api.planningcenteronline.com/people/v2/households/${householdId}/people`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        const members = membersData.data || [];

        for (const member of members) {
          // Skip self
          if (member.id === pcPersonId) continue;

          const familyMemberData = {
            contact_id: contactId,
            pc_person_id: member.id,
            name: member.attributes.name || 'Unknown',
            relationship: member.attributes.child ? 'child' : 'spouse',
            is_child: member.attributes.child || false,
            birthday: member.attributes.birthdate || null,
            avatar: member.attributes.avatar || null,
          };

          await supabase
            .from('contact_family_members')
            .upsert(familyMemberData, {
              onConflict: 'contact_id,pc_person_id',
              ignoreDuplicates: false,
            });
        }
      }
    }

  } catch (error) {
    console.error('Error syncing demographic data:', error);
    // Don't throw - we don't want to fail the whole chunk for demographic sync issues
  }
}

// Helper function to parse PCO date values
function parsePcoDateValue(value: any): string | null {
  if (!value) return null;
  
  // If it's already an ISO string, use it
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    return value;
  }
  
  // Try to parse common date formats from PCO
  // PCO can return: MM/DD/YYYY, YYYY-MM-DD, or ISO timestamps
  if (typeof value === 'string') {
    // Try MM/DD/YYYY format
    const mmddyyyyMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mmddyyyyMatch) {
      const [_, month, day, year] = mmddyyyyMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toISOString();
    }
    
    // Try parsing as a Date object
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  
  return null;
}

// Helper function to sync flow moments from PCO custom field data
async function syncFlowMomentsFromFieldData(
  contactId: string,
  organizationId: string,
  pcPersonId: string,
  auth: string,
  supabase: any
) {
  try {
    // Debug mode for specific people
    const DEBUG_PC_PERSON_IDS = ['43802262']; // Steven Hernandez
    const isDebugPerson = DEBUG_PC_PERSON_IDS.includes(pcPersonId);
    
    if (isDebugPerson) {
      console.log(`[DEBUG MODE] Processing person ${pcPersonId}`);
    }
    
    // 1. Fetch active mappings for this org
    const { data: mappings, error: mappingsError } = await supabase
      .from('pco_moment_mappings')
      .select('*, flow_moment_types(*)')
      .eq('organization_id', organizationId)
      .eq('is_active', true);
    
    if (mappingsError) {
      console.error('Error fetching moment mappings:', mappingsError);
      return;
    }
    
    if (!mappings || mappings.length === 0) {
      console.log('No active moment mappings found for organization');
      return;
    }
    
    console.log(`Found ${mappings.length} active moment mappings`);
    
    if (isDebugPerson) {
      console.log(`[DEBUG] Looking for field IDs: ${mappings.map(m => `${m.pco_source_identifier} (${m.pco_source_label})`).join(', ')}`);
    }
    
    // 2. Fetch field data from PCO for this person
    const fieldDataResponse = await fetch(
      `https://api.planningcenteronline.com/people/v2/people/${pcPersonId}/field_data?include=field_definition`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!fieldDataResponse.ok) {
      console.error(`Failed to fetch field data for person ${pcPersonId}: ${fieldDataResponse.statusText}`);
      return;
    }
    
    const fieldDataJson = await fieldDataResponse.json();
    const fieldDataArray = fieldDataJson.data || [];
    
    console.log(`Fetched ${fieldDataArray.length} field data entries for person ${pcPersonId}`);
    
    // Debug: Log all field definition IDs
    const fieldDefIds = fieldDataArray.map((fd: any) => ({
      id: fd.relationships?.field_definition?.data?.id,
      value: fd.attributes?.value
    }));
    console.log(`Field definition IDs for person ${pcPersonId}:`, JSON.stringify(fieldDefIds));
    
    // Debug logging for specific people
    if (isDebugPerson) {
      console.log(`[DEBUG] Raw PCO field_data response for ${pcPersonId}:`, JSON.stringify(fieldDataJson, null, 2));
      console.log(`[DEBUG] Field IDs returned by PCO:`, fieldDefIds.map(f => f.id));
      
      // Store debug info in database
      try {
        await supabase.from('pco_sync_debug_logs').upsert({
          pc_person_id: pcPersonId,
          contact_id: contactId,
          field_data_count: fieldDataArray.length,
          field_ids_returned: fieldDefIds.map(f => f.id),
          raw_response: fieldDataJson,
          checked_at: new Date().toISOString()
        }, { onConflict: 'pc_person_id' });
        console.log(`[DEBUG] Stored debug info in pco_sync_debug_logs`);
      } catch (debugError) {
        console.error('[DEBUG] Failed to store debug info:', debugError);
      }
    }
    
    // 3. For each mapping, check if condition matches
    for (const mapping of mappings) {
      console.log(`Checking mapping ${mapping.id} (${mapping.pco_source_label}) for field ID: ${mapping.pco_source_identifier}`);
      
      const fieldData = fieldDataArray.find(
        (fd: any) => fd.relationships?.field_definition?.data?.id === mapping.pco_source_identifier
      );
      
      if (!fieldData) {
        console.log(`Field data not found for mapping ${mapping.pco_source_label} (field ID: ${mapping.pco_source_identifier})`);
        continue;
      }
      
      console.log(`Found field data for ${mapping.pco_source_label}, value:`, fieldData.attributes?.value, 'attributes:', JSON.stringify(fieldData.attributes));
      
      // Helper to check truthy values (handles "true", "Yes", "1", etc.)
      const isTruthyValue = (val: any): boolean => {
        if (!val) return false;
        const normalized = String(val).toLowerCase().trim();
        return ['true', 'yes', '1', 'checked', 'on'].includes(normalized);
      };

      // Check trigger condition
      const value = fieldData.attributes?.value;
      const condition = mapping.trigger_condition || { operator: 'equals', value: 'Yes' };
      
      let shouldCreateMoment = false;
      
      if (condition.operator === 'is_truthy') {
        shouldCreateMoment = isTruthyValue(value);
      } else if (condition.operator === 'is_falsy') {
        shouldCreateMoment = value && !isTruthyValue(value);
      } else if (condition.operator === 'is_empty') {
        shouldCreateMoment = !value || String(value).trim() === '';
      } else if (condition.operator === 'is_not_empty') {
        shouldCreateMoment = !!value && String(value).trim() !== '';
      } else if (condition.operator === 'equals' && value === condition.value) {
        shouldCreateMoment = true;
      } else if (condition.operator === 'not_equals' && value !== condition.value) {
        shouldCreateMoment = true;
      }
      
      if (shouldCreateMoment) {
        console.log(`Creating moment for mapping ${mapping.id}: ${mapping.pco_source_label} = ${value}`);
        
        // Try to parse the value as a date if it looks like a date
        const parsedDate = parsePcoDateValue(value);
        // Fallback chain:
        // 1. Parsed date from field value (for date fields like "Date Baptized")
        // 2. created_at from PCO field_datum (when the field was first set)
        // 3. updated_at from PCO field_datum (when the field was last modified)
        // 4. Current timestamp (last resort)
        const occurredAt = parsedDate 
          || fieldData.attributes?.created_at 
          || fieldData.attributes?.updated_at 
          || new Date().toISOString();
        
        console.log(`Using occurred_at: ${occurredAt} (original value: ${value}, created_at: ${fieldData.attributes?.created_at}, updated_at: ${fieldData.attributes?.updated_at})`);
        
        // 4. Create or update flow moment
        const { error: momentError } = await supabase.from('flow_moments').upsert({
          contact_id: contactId,
          flow_moment_type_id: mapping.flow_moment_type_id,
          source_system: 'pco',
          source_reference: mapping.pco_source_identifier,
          occurred_at: occurredAt,
          metadata: {
            pco_field_value: value,
            pco_field_label: mapping.pco_source_label,
            tab_name: mapping.pco_tab_name,
          },
        }, {
          onConflict: 'contact_id,flow_moment_type_id,source_reference',
        });
        
        if (momentError) {
          console.error('Error creating flow moment:', momentError);
        } else {
          console.log(`Successfully created/updated moment for ${mapping.pco_source_label}`);
          
          // Update mapping last_synced_at
          await supabase
            .from('pco_moment_mappings')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', mapping.id);
        }
      }
    }
  } catch (error) {
    console.error('Error syncing flow moments:', error);
    // Don't throw - we don't want to fail the whole chunk for flow moments sync issues
  }
}


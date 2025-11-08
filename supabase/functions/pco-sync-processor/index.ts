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

    console.log('Processing next pending chunk from queue...');

    // Get next pending chunk (LIMIT 1, ordered by created_at)
    const { data: chunk, error: chunkError } = await supabase
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
      .limit(1)
      .single();

    if (chunkError || !chunk) {
      console.log('No pending chunks found');
      return new Response(JSON.stringify({ message: 'No pending chunks' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Processing chunk ${chunk.chunk_number} for job ${chunk.sync_job_id}`);

    // Mark chunk as processing
    await supabase
      .from('pco_sync_queue')
      .update({ status: 'processing' })
      .eq('id', chunk.id);

    try {
      const job = chunk.pco_sync_jobs;
      const integration = job.integrations;
      const mapping = job.integration_list_mappings;
      const people = chunk.chunk_data as any[];

      console.log(`Processing ${people.length} contacts in chunk ${chunk.chunk_number}`);

      // Get PC credentials
      const appId = integration.credentials.app_id;
      const secret = integration.credentials.secret;
      const auth = btoa(`${appId}:${secret}`);

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
      }

      return new Response(JSON.stringify({ 
        message: 'Chunk processed successfully',
        chunk_number: chunk.chunk_number,
        contacts_processed: people.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } catch (error) {
      console.error('Error processing chunk:', error);

      const newRetryCount = chunk.retry_count + 1;

      if (newRetryCount <= 3) {
        // Retry up to 3 times
        console.log(`Retrying chunk ${chunk.chunk_number}, attempt ${newRetryCount}`);
        await supabase
          .from('pco_sync_queue')
          .update({
            status: 'pending', // Set back to pending so it gets picked up again
            retry_count: newRetryCount,
            error_message: error.message
          })
          .eq('id', chunk.id);
      } else {
        // Mark as failed after 3 retries
        console.error(`Chunk ${chunk.chunk_number} failed after 3 retries`);
        await supabase
          .from('pco_sync_queue')
          .update({
            status: 'failed',
            error_message: error.message
          })
          .eq('id', chunk.id);

        // Update job status
        await supabase
          .from('pco_sync_jobs')
          .update({ 
            status: 'failed', 
            error_message: `Chunk ${chunk.chunk_number} failed: ${error.message}` 
          })
          .eq('id', chunk.sync_job_id);
      }

      throw error;
    }

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

  // Upsert contact
  const contactData = {
    organization_id: organizationId,
    pc_person_id: pcPersonId,
    name: attributes.name || 'Unknown',
    email: attributes.email_addresses?.[0]?.address || null,
    phone: attributes.phone_numbers?.[0]?.number || null,
    avatar: attributes.avatar || null,
    source_type: 'planning_center',
    last_synced_at: new Date().toISOString(),
  };

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
      `https://api.planningcenteronline.com/people/v2/people/${pcPersonId}?include=addresses,households,field_data`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!personResponse.ok) {
      console.error('Failed to fetch person details:', personResponse.status);
      return;
    }

    const personData = await personResponse.json();
    const person = personData.data;
    const included = personData.included || [];

    // Extract email and phone from detailed API response
    const detailedEmail = person.attributes.primary_email || null;
    const detailedPhone = person.attributes.primary_phone_number?.number || null;

    console.log(`Detailed API data for PC ID ${pcPersonId}:`, {
      email: detailedEmail,
      phone: detailedPhone
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

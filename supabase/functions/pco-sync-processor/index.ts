import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { getPcoAuthHeader } from '../_shared/pco-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to sleep for a specified number of milliseconds
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to fetch with retry and exponential backoff for rate limiting
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        const backoffDelay = Math.max(retryAfter * 1000, 1000 * Math.pow(2, attempt));
        console.log(`Rate limited (429). Waiting ${backoffDelay}ms before retry ${attempt + 1}/${maxRetries}`);
        
        if (attempt < maxRetries) {
          await sleep(backoffDelay);
          continue;
        }
        throw new Error(`Rate limited after ${maxRetries} retries`);
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      console.error(`Fetch attempt ${attempt + 1} failed:`, error);
      
      if (attempt < maxRetries) {
        const backoffDelay = 1000 * Math.pow(2, attempt);
        console.log(`Waiting ${backoffDelay}ms before retry...`);
        await sleep(backoffDelay);
      }
    }
  }
  
  throw lastError || new Error('Fetch failed after retries');
}

// Delay between API calls to prevent rate limiting (ms) - increased for safety
const API_CALL_DELAY = 500;
// Delay between processing chunks (ms)
const CHUNK_DELAY = 200;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing next pending chunks from queue...');

    // === CLEANUP OLD TERMINAL QUEUE ITEMS (prevent table bloat) ===
    try {
      const cleanupCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: deletedCount } = await supabase
        .from('pco_sync_queue')
        .delete({ count: 'exact' })
        .in('status', ['completed', 'cancelled', 'failed'])
        .lt('created_at', cleanupCutoff);
      if (deletedCount && deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old queue items (>24h, terminal state)`);
      }
    } catch (cleanupErr) {
      console.warn('Queue cleanup failed (non-fatal):', cleanupErr);
    }

    // === CLEANUP OLD TERMINAL SYNC JOBS (prevent table bloat) ===
    try {
      const jobsCleanupCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: deletedJobsCount } = await supabase
        .from('pco_sync_jobs')
        .delete({ count: 'exact' })
        .in('status', ['completed', 'cancelled', 'failed'])
        .lt('started_at', jobsCleanupCutoff);
      if (deletedJobsCount && deletedJobsCount > 0) {
        console.log(`🧹 Cleaned up ${deletedJobsCount} old sync jobs (>30d, terminal state)`);
      }
    } catch (cleanupError) {
      console.warn('⚠️ Jobs cleanup failed (non-fatal):', cleanupError);
    }

    // === ZOMBIE JOB AUTO-FINALIZE SWEEP ===
    // Clean up jobs that are stuck in pending/processing but have no pending queue items
    const zombieThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 minutes
    
    const { data: zombieJobs, error: zombieError } = await supabase
      .from('pco_sync_jobs')
      .select('id, status, started_at, total_contacts, list_mapping_id, integration_id')
      .in('status', ['pending', 'processing'])
      .lt('started_at', zombieThreshold);
    
    if (zombieJobs && zombieJobs.length > 0) {
      console.log(`🔍 Found ${zombieJobs.length} potentially zombie jobs older than 30 minutes`);
      
      for (const job of zombieJobs) {
        // Check if job has any pending/processing/retrying queue items
        const { data: pendingChunks, error: pendingError } = await supabase
          .from('pco_sync_queue')
          .select('id')
          .eq('sync_job_id', job.id)
          .in('status', ['pending', 'processing', 'retrying'])
          .limit(1);
        
        if (pendingError) {
          console.error(`Error checking pending chunks for job ${job.id}:`, pendingError);
          continue;
        }
        
        // If no pending work, this is a zombie job - auto-finalize it
        if (!pendingChunks || pendingChunks.length === 0) {
          // Check if any chunks completed successfully
          const { count: completedCount } = await supabase
            .from('pco_sync_queue')
            .select('id', { count: 'exact', head: true })
            .eq('sync_job_id', job.id)
            .eq('status', 'completed');
          
          const hasCompletedWork = (completedCount ?? 0) > 0;
          const finalStatus = hasCompletedWork ? 'completed' : 'cancelled';
          
          console.log(`🧟 Auto-finalizing zombie job ${job.id} as '${finalStatus}' (completed chunks: ${completedCount ?? 0})`);
          
          await supabase
            .from('pco_sync_jobs')
            .update({
              status: finalStatus,
              completed_at: new Date().toISOString(),
              error_message: 'Auto-finalized: job had no pending work items'
            })
            .eq('id', job.id);
          
          // Track PCO sync if job had completed work
          if (hasCompletedWork && job.integration_id) {
            const { data: integration } = await supabase
              .from('integrations')
              .select('organization_id')
              .eq('id', job.integration_id)
              .single();
            
            if (integration?.organization_id) {
              const syncType = job.list_mapping_id ? 'list_sync' : 'full_people_sync';
              await supabase.rpc('track_pco_sync', {
                p_org_id: integration.organization_id,
                p_sync_type: syncType
              });
            }
          }
        }
      }
    }
    // === END ZOMBIE JOB AUTO-FINALIZE SWEEP ===

    // === STALLED JOB CLEANUP (jobs stuck for 2+ hours regardless of queue state) ===
    const stalledThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours
    
    const { data: stalledJobs, error: stalledError } = await supabase
      .from('pco_sync_jobs')
      .select('id, status, started_at, processed_contacts, total_contacts')
      .in('status', ['pending', 'processing'])
      .lt('started_at', stalledThreshold);
    
    if (stalledJobs && stalledJobs.length > 0) {
      console.log(`⏰ Found ${stalledJobs.length} stalled jobs older than 2 hours - cancelling`);
      
      for (const job of stalledJobs) {
        console.log(`🛑 Cancelling stalled job ${job.id} (started at ${job.started_at}, progress: ${job.processed_contacts}/${job.total_contacts})`);
        
        // Cancel the job
        await supabase
          .from('pco_sync_jobs')
          .update({
            status: 'cancelled',
            completed_at: new Date().toISOString(),
            error_message: 'Auto-cancelled: job stalled for over 2 hours'
          })
          .eq('id', job.id);
        
        // Cancel any remaining queue items
        await supabase
          .from('pco_sync_queue')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('sync_job_id', job.id)
          .in('status', ['pending', 'processing', 'retrying']);
      }
    }
    // === END STALLED JOB CLEANUP ===

    // === STUCK CHUNK RECOVERY ===
    // Reset chunks that have been in "processing" status for more than 10 minutes
    const stuckThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    // First, reset stuck chunks with retry_count < 3 to pending
    const { data: resetChunks, error: resetError } = await supabase
      .from('pco_sync_queue')
      .update({ 
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'processing')
      .lt('updated_at', stuckThreshold)
      .lt('retry_count', 3)
      .select('id, chunk_number, sync_job_id, retry_count');
    
    if (resetChunks && resetChunks.length > 0) {
      console.log(`♻️ Reset ${resetChunks.length} stuck chunks for retry:`, 
        resetChunks.map(c => `chunk ${c.chunk_number} (retry ${c.retry_count})`).join(', '));
      
      // Increment retry count separately for reset chunks
      for (const chunk of resetChunks) {
        await supabase
          .from('pco_sync_queue')
          .update({ retry_count: (chunk.retry_count || 0) + 1 })
          .eq('id', chunk.id);
      }
    }
    
    // Mark chunks as failed if they've exceeded retry limit while stuck
    const { data: failedChunks, error: failError } = await supabase
      .from('pco_sync_queue')
      .update({ 
        status: 'failed', 
        error_message: 'Exceeded maximum retry attempts after timeout',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'processing')
      .lt('updated_at', stuckThreshold)
      .gte('retry_count', 3)
      .select('id, chunk_number, sync_job_id');
    
    if (failedChunks && failedChunks.length > 0) {
      console.log(`❌ Marked ${failedChunks.length} stuck chunks as failed (exceeded retries)`);
      
      // Check if any jobs need to be completed after failing chunks
      const jobIds = [...new Set(failedChunks.map(c => c.sync_job_id))];
      for (const jobId of jobIds) {
        await checkAndCompleteJob(supabase, jobId);
      }
    }
    // === END STUCK CHUNK RECOVERY ===

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

    // Select up to 5 chunks using round-robin (one per organization) - reduced from 20 for safer resource usage
    const selectedChunks = [];
    const seenOrgs = new Set();
    
    for (const chunk of chunks) {
      if (!seenOrgs.has(chunk.organization_id)) {
        selectedChunks.push(chunk);
        seenOrgs.add(chunk.organization_id);
        if (selectedChunks.length >= 5) break;
      }
    }

    console.log(`Processing ${selectedChunks.length} chunks from ${seenOrgs.size} organizations`);

    let successCount = 0;
    let errorCount = 0;
    const processedOrgs = new Set();

    // Process each selected chunk
    for (const chunk of selectedChunks) {
      try {
        // Check if job was cancelled before processing this chunk
        const { data: jobCheck } = await supabase
          .from('pco_sync_jobs')
          .select('status')
          .eq('id', chunk.sync_job_id)
          .single();

        if (jobCheck?.status === 'cancelled') {
          console.log(`Job ${chunk.sync_job_id} was cancelled, skipping chunk ${chunk.chunk_number}`);
          await supabase
            .from('pco_sync_queue')
            .update({ status: 'cancelled' })
            .eq('id', chunk.id);
          continue;
        }

        console.log(`Processing chunk ${chunk.chunk_number} for job ${chunk.sync_job_id} (org: ${chunk.organization_id})`);
        processedOrgs.add(chunk.organization_id);

        // Mark chunk as processing
        await supabase
          .from('pco_sync_queue')
          .update({ status: 'processing' })
          .eq('id', chunk.id);

        const job = chunk.pco_sync_jobs;
        const integration = job.integrations;
        const mapping = job.integration_list_mappings; // May be null for full people sync
        const people = chunk.chunk_data as any[];
        
        // Check if this chunk has pre-fetched data (from optimized sync)
        const hasPrefetchedData = people.length > 0 && people[0]?.included_data;

        console.log(`Processing ${people.length} contacts in chunk ${chunk.chunk_number} (full sync: ${!mapping}, prefetched: ${hasPrefetchedData})`);

        const { header: pcoAuthHeader } = await getPcoAuthHeader(supabase, integration.id);

        // Sync campuses once per org (on first chunk - chunks start at 1)
        if (chunk.chunk_number === 1) {
          await syncCampuses(integration.organization_id, pcoAuthHeader, supabase);
        }

        // Process each person in the chunk with delay between API calls
        for (let i = 0; i < people.length; i++) {
          const person = people[i];
          await processPersonData(person, integration.organization_id, mapping, pcoAuthHeader, supabase, hasPrefetchedData);
          
          // Add delay between person processing to avoid rate limiting
          // Reduced delay if we have pre-fetched data (fewer API calls needed)
          if (i < people.length - 1) {
            await sleep(hasPrefetchedData ? 100 : API_CALL_DELAY);
          }
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
            const syncType = job.list_mapping_id ? 'list_sync' : 'full_people_sync';
            await supabase.rpc('track_pco_sync', {
              p_org_id: integration.organization_id,
              p_sync_type: syncType
            });
            
            // Update mapping last_sync_at (only if this was a list sync)
            if (job.list_mapping_id) {
              await supabase
                .from('integration_list_mappings')
                .update({ last_sync_at: new Date().toISOString() })
                .eq('id', job.list_mapping_id);
            }
            
            // Update last_full_sync_completed_at for full people syncs
            // This enables accurate incremental sync on next run
            if (!job.list_mapping_id) {
              await supabase
                .from('integrations')
                .update({ last_full_sync_completed_at: new Date().toISOString() })
                .eq('id', integration.id);
              
              console.log(`Updated last_full_sync_completed_at for integration ${integration.id}`);
              
              // Populate family members from household matching after full sync
              await populateFamilyMembersFromHouseholds(integration.organization_id, supabase);
            }
          }
        }

        successCount++;
        
        // Add delay between chunks to prevent overwhelming the database
        await sleep(CHUNK_DELAY);

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
  pcoAuthHeader: string,
  supabase: any,
  hasPrefetchedData: boolean = false
) {
  const pcPersonId = person.id;
  const includedData = person.included_data || null;
  
  // If we only have an ID reference (from list_results), fetch full person data from PCO
  let attributes = person.attributes;
  if (!attributes) {
    console.log(`Fetching full person data for PC ID: ${pcPersonId}`);
    const personResponse = await fetchWithRetry(
      `https://api.planningcenteronline.com/people/v2/people/${pcPersonId}?include=emails,phone_numbers,addresses,households,field_data`,
      {
        headers: {
          'Authorization': pcoAuthHeader,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!personResponse.ok) {
      console.error(`Failed to fetch person ${pcPersonId}: ${personResponse.status}`);
      throw new Error(`Failed to fetch person data: ${personResponse.status}`);
    }
    
    const personData = await personResponse.json();
    attributes = personData.data?.attributes || {};
    
    // Extract data from included array
    const included = personData.included || [];
    const emails = included.filter((i: any) => i.type === 'Email');
    const phones = included.filter((i: any) => i.type === 'PhoneNumber');
    const addresses = included.filter((i: any) => i.type === 'Address');
    const fieldData = included.filter((i: any) => i.type === 'FieldDatum');
    const households = included.filter((i: any) => i.type === 'Household');
    
    // Get household ID
    const householdId = households[0]?.id || 
      personData.data?.relationships?.households?.data?.[0]?.id || null;
    
    // Attach to attributes for consistent processing below
    if (emails.length > 0) {
      attributes.emails = emails;
    }
    if (phones.length > 0) {
      attributes.phone_numbers = phones;
    }
    
    // Create included_data for later use
    person.included_data = {
      householdId,
      addresses,
      fieldData,
      emails,
      phones,
    };
  }

  // Extract household ID from pre-fetched data
  const householdId = includedData?.householdId || person.included_data?.householdId || null;

  // Upsert contact - only include email/phone if we have actual values to avoid overwriting with null
  const contactData: any = {
    organization_id: organizationId,
    pc_person_id: pcPersonId,
    pc_household_id: householdId, // NEW: Store household ID for local matching
    name: attributes.name || 'Unknown',
    avatar: attributes.avatar || null,
    source_type: 'planning_center',
    last_synced_at: new Date().toISOString(),
  };
  
  // Handle email - check both formats (inline and from included)
  const emailAddress = attributes.email_addresses?.[0]?.address 
    || attributes.emails?.[0]?.attributes?.address;
  if (emailAddress) {
    contactData.email = emailAddress;
  }
  
  // Handle phone - check both formats (inline and from included)
  const phoneNumber = attributes.phone_numbers?.[0]?.number 
    || attributes.phone_numbers?.[0]?.attributes?.number;
  if (phoneNumber) {
    contactData.phone = phoneNumber;
  }

  // Resolve campus_id from primary_campus_id
  const pcoCampusId = attributes.primary_campus?.data?.id 
    || person.relationships?.primary_campus?.data?.id
    || attributes.primary_campus_id
    || null;
  
  if (pcoCampusId) {
    const { data: campus } = await supabase
      .from('campuses')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('pco_campus_id', String(pcoCampusId))
      .single();
    
    if (campus) {
      contactData.campus_id = campus.id;
    }
  }

  console.log(`Syncing contact ${attributes.name} (PC ID: ${pcPersonId}, Household: ${householdId || 'none'}):`, {
    email: contactData.email,
    phone: contactData.phone,
    has_campus: !!pcoCampusId,
    campus_id: contactData.campus_id || null
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

  // Only add to pipeline if we have a mapping (list sync, not full people sync)
  if (mapping?.pipeline_id && mapping?.stage_id) {
    // Add to pipeline if not already in it
    const { data: existingPipelineContact } = await supabase
      .from('pipeline_contacts')
      .select('id')
      .eq('contact_id', contact.id)
      .eq('pipeline_id', mapping.pipeline_id)
      .single();

    if (!existingPipelineContact) {
      // Fetch the stage's default assignee for auto-assignment
      let assignedToUserId = null;
      const { data: stageData } = await supabase
        .from('pipeline_stages')
        .select('default_assignee_user_id')
        .eq('id', mapping.stage_id)
        .single();
      
      if (stageData?.default_assignee_user_id) {
        assignedToUserId = stageData.default_assignee_user_id;
        console.log(`Auto-assigning contact to user ${assignedToUserId} based on stage default`);
      }

      const { error: pipelineError } = await supabase
        .from('pipeline_contacts')
        .insert({
          contact_id: contact.id,
          pipeline_id: mapping.pipeline_id,
          stage_id: mapping.stage_id,
          source_type: 'planning_center',
          source_id: pcPersonId,
          assigned_to_user_id: assignedToUserId,
        });

      if (pipelineError) {
        console.error('Error adding contact to pipeline:', pipelineError);
      } else {
        console.log(`Added contact ${contact.name} to pipeline${assignedToUserId ? ' (auto-assigned)' : ''}`);
      }
    }
  } else {
    console.log(`Contact ${contact.name} synced without flow assignment (full people sync)`);
  }

  // Sync demographic data - pass pre-fetched data if available to avoid API calls
  await syncDemographicData(contact.id, pcPersonId, pcoAuthHeader, supabase, person.included_data);
  
  // Sync flow moments from custom field data - pass pre-fetched data if available
  await syncFlowMomentsFromFieldData(contact.id, organizationId, pcPersonId, pcoAuthHeader, supabase, person.included_data);
}

// Helper function to sync demographic data from Planning Center
// OPTIMIZED: Uses pre-fetched data when available to avoid redundant API calls
async function syncDemographicData(
  contactId: string,
  pcPersonId: string,
  pcoAuthHeader: string,
  supabase: any,
  includedData?: any
) {
  try {
    let person: any;
    let addresses: any[] = [];
    let fieldData: any[] = [];
    let householdId: string | null = null;
    
    // Check if we have pre-fetched data
    if (includedData?.addresses && includedData?.fieldData) {
      console.log(`[Demographics] Using pre-fetched data for PC ID ${pcPersonId}`);
      
      // Use pre-fetched data directly
      addresses = includedData.addresses || [];
      fieldData = includedData.fieldData || [];
      householdId = includedData.householdId || null;
      
      // Still need to get basic person attributes for demographics
      // But we can skip the full API call for included data
      person = { attributes: {} };
      
      // Get person attributes from database if needed
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();
      
      // For demographics, we actually need to fetch person data once
      // But we skip the addresses/field_data/households includes
      await sleep(API_CALL_DELAY);
      
      const personResponse = await fetchWithRetry(
        `https://api.planningcenteronline.com/people/v2/people/${pcPersonId}`,
        {
          headers: {
            'Authorization': pcoAuthHeader,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (personResponse.ok) {
        const personData = await personResponse.json();
        person = personData.data;
      }
    } else {
      // No pre-fetched data - make full API call (legacy path for list syncs)
      console.log(`[Demographics] Fetching full data from API for PC ID ${pcPersonId}`);
      
      // Add delay before demographic sync to prevent rate limiting
      await sleep(API_CALL_DELAY);
      
      // Fetch person details with demographics
      const personResponse = await fetchWithRetry(
        `https://api.planningcenteronline.com/people/v2/people/${pcPersonId}?include=addresses,households,field_data,phone_numbers,emails`,
        {
          headers: {
            'Authorization': pcoAuthHeader,
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
      person = personData.data;
      const included = personData.included || [];
      
      addresses = included.filter((item: any) => item.type === 'Address');
      fieldData = included.filter((item: any) => item.type === 'FieldDatum');
      const households = included.filter((item: any) => item.type === 'Household');
      householdId = households[0]?.id || null;
      
      // Parse email addresses and phone numbers from included relationships
      const emails = included.filter((i: any) => i.type === 'Email');
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
        if (householdId) updateData.pc_household_id = householdId;

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
    }

    // Sync demographics
    const demographicData: any = {};
    
    if (person?.attributes) {
      console.log(`[Demographics] Processing PC ID ${pcPersonId}:`, {
        birthdate: person.attributes.birthdate,
        gender: person.attributes.gender,
        marital_status: person.attributes.marital_status
      });
      
      if (person.attributes.birthdate) {
        demographicData.birthday = person.attributes.birthdate;
      }
      if (person.attributes.gender) {
        demographicData.gender = person.attributes.gender;
      }
      if (person.attributes.marital_status) {
        demographicData.marital_status = person.attributes.marital_status;
      }
    }

    // Look for occupation in field_data
    const occupationField = fieldData.find((field: any) => 
      field.attributes?.field_definition_name?.toLowerCase().includes('occupation')
    );
    if (occupationField?.attributes?.value) {
      demographicData.occupation = occupationField.attributes.value;
    }

    if (Object.keys(demographicData).length > 0) {
      demographicData.contact_id = contactId;
      
      const { error: demoError } = await supabase
        .from('contact_demographics')
        .upsert(demographicData, {
          onConflict: 'contact_id',
          ignoreDuplicates: false,
        });
      
      if (demoError) {
        console.error(`[Demographics] Error upserting for contact ${contactId}:`, demoError);
      } else {
        console.log(`[Demographics] Successfully synced for contact ${contactId}:`, demographicData);
      }
    } else {
      console.log(`[Demographics] No demographic data found in PCO for PC ID ${pcPersonId}`);
    }

    // Sync addresses (from pre-fetched or API data)
    console.log(`[Addresses] Found ${addresses.length} addresses for PC ID ${pcPersonId}`);
    
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

      const { error: addrError } = await supabase
        .from('contact_addresses')
        .upsert(addressData, {
          onConflict: 'contact_id,address_type',
          ignoreDuplicates: false,
        });
      
      if (addrError) {
        console.error(`[Addresses] Error upserting address for contact ${contactId}:`, addrError);
      }
    }

    // NOTE: Household/family members are now populated via local matching after sync completes
    // See populateFamilyMembersFromHouseholds() - this avoids extra API calls per contact
    console.log(`[Households] Skipping per-contact household fetch (using local matching instead) for PC ID ${pcPersonId}`);

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
// OPTIMIZED: Uses pre-fetched data when available
async function syncFlowMomentsFromFieldData(
  contactId: string,
  organizationId: string,
  pcPersonId: string,
  auth: string,
  supabase: any,
  includedData?: any
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
    
    // 2. Get field data - use pre-fetched if available
    let fieldDataArray: any[] = [];
    
    if (includedData?.fieldData && includedData.fieldData.length > 0) {
      console.log(`[FlowMoments] Using pre-fetched field data for PC ID ${pcPersonId}`);
      fieldDataArray = includedData.fieldData;
    } else {
      // Fetch field data from PCO for this person (with delay to prevent rate limiting)
      await sleep(API_CALL_DELAY);
      
      const fieldDataResponse = await fetchWithRetry(
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
      fieldDataArray = fieldDataJson.data || [];
    }
    
    console.log(`Fetched ${fieldDataArray.length} field data entries for person ${pcPersonId}`);
    
    // Debug: Log all field definition IDs
    const fieldDefIds = fieldDataArray.map((fd: any) => ({
      id: fd.relationships?.field_definition?.data?.id,
      value: fd.attributes?.value
    }));
    console.log(`Field definition IDs for person ${pcPersonId}:`, JSON.stringify(fieldDefIds));
    
    // Debug logging for specific people
    if (isDebugPerson) {
      console.log(`[DEBUG] Field IDs returned by PCO:`, fieldDefIds.map(f => f.id));
      
      // Store debug info in database
      try {
        await supabase.from('pco_sync_debug_logs').upsert({
          pc_person_id: pcPersonId,
          contact_id: contactId,
          field_data_count: fieldDataArray.length,
          field_ids_returned: fieldDefIds.map(f => f.id),
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

// NEW: Populate family members from household matching after sync completes
// This uses local data instead of making API calls per contact
async function populateFamilyMembersFromHouseholds(organizationId: string, supabase: any) {
  try {
    console.log(`[Households] Starting local family member population for org ${organizationId}...`);
    
    // Get all contacts with household IDs in this organization
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, pc_person_id, pc_household_id, name, avatar')
      .eq('organization_id', organizationId)
      .not('pc_household_id', 'is', null);
    
    if (contactsError) {
      console.error('[Households] Error fetching contacts:', contactsError);
      return;
    }
    
    if (!contacts || contacts.length === 0) {
      console.log('[Households] No contacts with household IDs found');
      return;
    }
    
    console.log(`[Households] Found ${contacts.length} contacts with household IDs`);
    
    // Group contacts by household ID
    const householdMap = new Map<string, any[]>();
    for (const contact of contacts) {
      if (!contact.pc_household_id) continue;
      
      if (!householdMap.has(contact.pc_household_id)) {
        householdMap.set(contact.pc_household_id, []);
      }
      householdMap.get(contact.pc_household_id)!.push(contact);
    }
    
    console.log(`[Households] Found ${householdMap.size} unique households`);
    
    let totalFamilyMembersCreated = 0;
    
    // For each household with multiple members, create family member records
    for (const [householdId, members] of householdMap) {
      if (members.length < 2) continue; // Solo household, skip
      
      for (const contact of members) {
        // Get other household members (excluding self)
        const familyMembers = members
          .filter(m => m.id !== contact.id)
          .map(m => ({
            contact_id: contact.id,
            pc_person_id: m.pc_person_id,
            name: m.name,
            avatar: m.avatar,
            relationship: 'Household Member',
            is_child: false, // Can't determine from local data alone
          }));
        
        if (familyMembers.length === 0) continue;
        
        // Upsert family members (using contact_id + pc_person_id as conflict key)
        for (const member of familyMembers) {
          const { error: famError } = await supabase
            .from('contact_family_members')
            .upsert(member, {
              onConflict: 'contact_id,pc_person_id',
              ignoreDuplicates: false,
            });
          
          if (famError) {
            console.error(`[Households] Error upserting family member:`, famError);
          } else {
            totalFamilyMembersCreated++;
          }
        }
      }
    }
    
    console.log(`[Households] ✅ Created/updated ${totalFamilyMembersCreated} family member records using local matching`);
    
  } catch (error) {
    console.error('[Households] Error populating family members:', error);
    // Don't throw - this is a non-critical enhancement
  }
}

// Helper function to check if a job should be marked as complete
async function checkAndCompleteJob(supabase: any, jobId: string) {
  try {
    // Check if there are any remaining pending or processing chunks
    const { data: remainingChunks, error: remainingError } = await supabase
      .from('pco_sync_queue')
      .select('id')
      .eq('sync_job_id', jobId)
      .in('status', ['pending', 'processing']);
    
    if (remainingError) {
      console.error('Error checking remaining chunks:', remainingError);
      return;
    }
    
    // If there are still pending/processing chunks, job is not done
    if (remainingChunks && remainingChunks.length > 0) {
      return;
    }
    
    // Count failed chunks
    const { count: failedCount, error: failedError } = await supabase
      .from('pco_sync_queue')
      .select('id', { count: 'exact', head: true })
      .eq('sync_job_id', jobId)
      .eq('status', 'failed');
    
    if (failedError) {
      console.error('Error counting failed chunks:', failedError);
      return;
    }
    
    // Get job details to calculate final processed count
    const { data: job } = await supabase
      .from('pco_sync_jobs')
      .select('id, status, integration_id, list_mapping_id, total_contacts')
      .eq('id', jobId)
      .single();
    
    if (!job || job.status === 'completed' || job.status === 'cancelled') {
      return;
    }
    
    // Count completed chunks and calculate processed contacts
    const { data: completedChunks } = await supabase
      .from('pco_sync_queue')
      .select('chunk_data')
      .eq('sync_job_id', jobId)
      .eq('status', 'completed');
    
    const processedContacts = completedChunks?.reduce((sum: number, chunk: any) => {
      const chunkData = chunk.chunk_data as any[];
      return sum + (chunkData?.length || 0);
    }, 0) || 0;
    
    // Determine final status and error message
    const hasFailures = failedCount && failedCount > 0;
    const errorMessage = hasFailures 
      ? `Completed with ${failedCount} failed chunks` 
      : null;
    
    console.log(`✅ Job ${jobId} complete: ${processedContacts} contacts processed, ${failedCount || 0} chunks failed`);
    
    // Update job as completed
    await supabase
      .from('pco_sync_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        processed_contacts: processedContacts,
        error_message: errorMessage
      })
      .eq('id', jobId);
    
    // Get organization ID for tracking
    const { data: integration } = await supabase
      .from('integrations')
      .select('organization_id')
      .eq('id', job.integration_id)
      .single();
    
    if (integration?.organization_id) {
      const syncType = job.list_mapping_id ? 'list_sync' : 'full_people_sync';
      await supabase.rpc('track_pco_sync', {
        p_org_id: integration.organization_id,
        p_sync_type: syncType
      });
      
      // Update mapping last_sync_at if this was a list sync
      if (job.list_mapping_id) {
        await supabase
          .from('integration_list_mappings')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', job.list_mapping_id);
      }

      // Update last_full_sync_completed_at for full people syncs
      if (!job.list_mapping_id) {
        await supabase
          .from('integrations')
          .update({ last_full_sync_completed_at: new Date().toISOString() })
          .eq('id', job.integration_id);

        // Populate family members from household matching
        await populateFamilyMembersFromHouseholds(integration.organization_id, supabase);
      }
    }
  } catch (error) {
    console.error('Error checking job completion:', error);
  }
}

// Helper function to sync campuses from PCO
async function syncCampuses(
  organizationId: string,
  auth: string,
  supabase: any
) {
  try {
    console.log(`🏛️ Syncing campuses for org ${organizationId}`);

    const response = await fetchWithRetry(
      'https://api.planningcenteronline.com/people/v2/campuses',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Failed to fetch campuses: ${response.status}`);
      return;
    }

    const data = await response.json();
    const campuses = data.data || [];

    if (campuses.length === 0) {
      console.log('No campuses found in PCO');
      return;
    }

    console.log(`Found ${campuses.length} campuses in PCO`);

    for (const campus of campuses) {
      const attrs = campus.attributes || {};
      const { error } = await supabase
        .from('campuses')
        .upsert({
          organization_id: organizationId,
          pco_campus_id: campus.id,
          name: attrs.name || 'Unknown Campus',
          address: attrs.street || null,
          city: attrs.city || null,
          state: attrs.state || null,
          zip_code: attrs.zip || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,pco_campus_id',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`Error upserting campus ${campus.id}:`, error);
      } else {
        console.log(`✅ Campus synced: ${attrs.name}`);
      }
    }
  } catch (error) {
    console.warn('Campus sync failed (non-fatal):', error);
  }
}


// Church Online Webhook - v3.0.0
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, ce-id, ce-source, ce-type, ce-subject, ce-time',
};

Deno.serve(async (req) => {
  console.log('=== Church Online Webhook Received ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const integrationId = url.searchParams.get('integration_id');

    if (!integrationId) {
      console.error('Missing integration_id parameter');
      return new Response(
        JSON.stringify({ error: 'Missing integration_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse CloudEvents format - headers contain metadata
    const ceId = req.headers.get('ce-id') || crypto.randomUUID();
    const ceType = req.headers.get('ce-type') || 'unknown';
    const ceSubject = req.headers.get('ce-subject') || null;
    const ceTime = req.headers.get('ce-time') || new Date().toISOString();

    // Parse body
    const body = await req.json();
    
    console.log('Received Church Online webhook:', {
      integrationId,
      eventId: ceId,
      eventType: ceType,
      subject: ceSubject,
      time: ceTime,
      body: JSON.stringify(body)
    });

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify integration exists and get organization
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('id, organization_id, status, settings')
      .eq('id', integrationId)
      .eq('service_name', 'church_online')
      .single();

    if (integrationError || !integration) {
      console.error('Integration not found:', integrationId);
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found integration for org:', integration.organization_id);

    // Log the event (with deduplication via unique constraint)
    const { data: eventRecord, error: eventError } = await supabase
      .from('church_online_events')
      .upsert({
        organization_id: integration.organization_id,
        integration_id: integrationId,
        event_type: ceType,
        event_id: ceId,
        subject: ceSubject,
        data: body
      }, {
        onConflict: 'integration_id,event_id',
        ignoreDuplicates: true
      })
      .select('id')
      .single();

    if (eventError && !eventError.message.includes('duplicate')) {
      console.error('Failed to log event:', eventError);
    }

    console.log('Event logged:', eventRecord?.id);

    // Try to match user to contact by email
    let contactId: string | null = null;
    const userEmail = body.email || (body.user ? body.user.email : null);
    const userFirstName = body.firstName || (body.user ? body.user.firstName : '');
    const userLastName = body.lastName || (body.user ? body.user.lastName : '');
    const userName = body.name || (body.user ? body.user.name : null) || `${userFirstName} ${userLastName}`.trim();

    console.log('User data:', { email: userEmail, name: userName });

    if (userEmail) {
      // Find existing contact by email
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('organization_id', integration.organization_id)
        .eq('email', userEmail)
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
        console.log('Found existing contact:', contactId);
      }
    }

    // Get active automations for this event type
    const { data: automations } = await supabase
      .from('church_online_flow_automations')
      .select('*')
      .eq('integration_id', integrationId)
      .eq('event_type', ceType)
      .eq('is_active', true);

    console.log('Found automations:', automations?.length || 0);

    // Process each automation
    for (const automation of automations || []) {
      try {
        console.log('Processing automation:', automation.id);

        // Check if event matches filter (if any)
        if (automation.event_filter && Object.keys(automation.event_filter).length > 0) {
          const filter = automation.event_filter as Record<string, unknown>;
          let matches = true;
          
          for (const [key, value] of Object.entries(filter)) {
            const bodyData = body.data || body;
            if (body[key] !== value && bodyData[key] !== value) {
              matches = false;
              break;
            }
          }
          
          if (!matches) {
            console.log('Event filter did not match, skipping');
            continue;
          }
        }

        // Create contact if missing and allowed
        if (!contactId && automation.create_contact_if_missing && userEmail) {
          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              organization_id: integration.organization_id,
              name: userName || userEmail.split('@')[0],
              email: userEmail,
              phone: body.phone || (body.user ? body.user.phone : null),
              source_type: 'church_online'
            })
            .select('id')
            .single();

          if (!contactError && newContact) {
            contactId = newContact.id;
            console.log('Created new contact:', contactId);
          } else if (contactError) {
            console.error('Failed to create contact:', contactError);
          }
        }

        if (!contactId) {
          console.log('No contact found/created for automation:', automation.id);
          continue;
        }

        // Add to flow if pipeline/stage specified
        if (automation.pipeline_id && automation.stage_id) {
          // Check if already in this pipeline using contact_interactions
          const { data: existingPipelineContact } = await supabase
            .from('contact_interactions')
            .select('id')
            .eq('contact_id', contactId)
            .eq('pipeline_id', automation.pipeline_id)
            .eq('interaction_type', 'pipeline_entry')
            .maybeSingle();

          if (!existingPipelineContact) {
            const { error: pipelineError } = await supabase
              .from('contact_interactions')
              .insert({
                contact_id: contactId,
                pipeline_id: automation.pipeline_id,
                stage_id: automation.stage_id,
                interaction_type: 'pipeline_entry',
                subject: 'Added from Church Online',
                details: `Automatically added via ${ceType} event`,
                created_by_user_id: null,
              });

            if (pipelineError) {
              console.error('Failed to add to pipeline:', pipelineError);
            } else {
              console.log('Added contact to pipeline:', automation.pipeline_id);
            }
          } else {
            console.log('Contact already in pipeline');
          }
        }

        // Create flow moment if type specified
        if (automation.flow_moment_type_id && contactId) {
          const { error: momentError } = await supabase
            .from('flow_moments')
            .insert({
              contact_id: contactId,
              flow_moment_type_id: automation.flow_moment_type_id,
              source_system: 'church_online',
              source_reference: ceId,
              occurred_at: ceTime,
              metadata: {
                event_type: ceType,
                ...body
              }
            });

          if (momentError) {
            console.error('Failed to create flow moment:', momentError);
          } else {
            console.log('Created flow moment for contact:', contactId);
          }
        }

      } catch (automationError) {
        console.error('Automation processing error:', automationError);
      }
    }

    // Update event with matched contact
    if (contactId && eventRecord?.id) {
      await supabase
        .from('church_online_events')
        .update({ 
          contact_id: contactId,
          processed_at: new Date().toISOString()
        })
        .eq('id', eventRecord.id);
    }

    console.log('=== Webhook processing complete ===');

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventId: ceId,
        contactId,
        automationsProcessed: automations?.length || 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log('Starting recurring flow processor...');

    // Find all recurring flows with their end stages
    const { data: recurringFlows, error: flowsError } = await supabaseClient
      .from('pipelines')
      .select(`
        id,
        name,
        cycle_days,
        pipeline_stages!inner(
          id,
          name,
          is_start_step,
          is_end_step
        )
      `)
      .eq('flow_type', 'recurring')
      .not('cycle_days', 'is', null);

    if (flowsError) {
      console.error('Error fetching recurring flows:', flowsError);
      throw flowsError;
    }

    if (!recurringFlows || recurringFlows.length === 0) {
      console.log('No recurring flows found');
      return new Response(
        JSON.stringify({ message: 'No recurring flows to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${recurringFlows.length} recurring flows`);

    let totalCycled = 0;

    // Process each recurring flow
    for (const flow of recurringFlows) {
      const stages = flow.pipeline_stages as any[];
      const endStage = stages.find((s: any) => s.is_end_step);
      const startStage = stages.find((s: any) => s.is_start_step);

      if (!endStage || !startStage) {
        console.log(`Flow ${flow.name} missing start or end stage, skipping`);
        continue;
      }

      console.log(`Processing flow: ${flow.name} (cycle: ${flow.cycle_days} days)`);

      // Find contacts in end stage that have exceeded cycle_days
      const cycleDate = new Date();
      cycleDate.setDate(cycleDate.getDate() - flow.cycle_days);

      const { data: contactsToReset, error: contactsError } = await supabaseClient
        .from('pipeline_contacts')
        .select('id, contact_id, contacts(name)')
        .eq('pipeline_id', flow.id)
        .eq('stage_id', endStage.id)
        .lt('stage_entered_at', cycleDate.toISOString());

      if (contactsError) {
        console.error(`Error fetching contacts for flow ${flow.name}:`, contactsError);
        continue;
      }

      if (!contactsToReset || contactsToReset.length === 0) {
        console.log(`No contacts ready to cycle in ${flow.name}`);
        continue;
      }

      console.log(`Found ${contactsToReset.length} contacts to cycle in ${flow.name}`);

      // Move contacts back to start stage
      for (const pc of contactsToReset) {
        const { error: updateError } = await supabaseClient
          .from('pipeline_contacts')
          .update({
            stage_id: startStage.id,
            stage_entered_at: new Date().toISOString(),
            completed_end_at: null, // Clear completion
          })
          .eq('id', pc.id);

        if (updateError) {
          console.error(`Error updating contact ${pc.contact_id}:`, updateError);
          continue;
        }

        // Create interaction record
        await supabaseClient.from('contact_interactions').insert({
          contact_id: pc.contact_id,
          pipeline_id: flow.id,
          stage_id: startStage.id,
          previous_stage_id: endStage.id,
          interaction_type: 'cycle_restart',
          subject: `Cycled back to start in ${flow.name}`,
          details: `Automatically moved from "${endStage.name}" to "${startStage.name}" after ${flow.cycle_days} days`,
          completed_at: new Date().toISOString(),
          metadata: {
            cycle_days: flow.cycle_days,
            flow_type: 'recurring',
          }
        });

        totalCycled++;
        console.log(`Cycled contact ${(pc.contacts as any)?.name || pc.contact_id} in ${flow.name}`);
      }
    }

    console.log(`Recurring flow processor completed. Total contacts cycled: ${totalCycled}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${recurringFlows.length} recurring flows`,
        contactsCycled: totalCycled,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in recurring-flow-processor:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

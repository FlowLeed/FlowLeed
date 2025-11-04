import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create regular client to verify user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.log('Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Tracking login for user:', user.id);

    // Get user's organization
    const { data: orgMember, error: orgError } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (orgError || !orgMember) {
      console.log('User not in any organization:', orgError);
      // Don't fail - user might not be in an org yet (during signup)
      return new Response(
        JSON.stringify({ success: true, message: 'No organization found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User organization:', orgMember.organization_id);

    // Call the track_user_login function
    const { error: trackError } = await supabaseAdmin.rpc('track_user_login', {
      p_user_id: user.id,
      p_org_id: orgMember.organization_id
    });

    if (trackError) {
      console.error('Error tracking login:', trackError);
      return new Response(
        JSON.stringify({ error: 'Failed to track login', details: trackError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Login tracked successfully for user:', user.id);

    // Safety net: Check if organization has any pipelines, create defaults if empty
    const { data: pipelinesBefore, error: pipelinesError } = await supabaseAdmin
      .from('pipelines')
      .select('id')
      .eq('organization_id', orgMember.organization_id);

    const pipelineCountBefore = pipelinesBefore?.length || 0;
    console.log(`Organization ${orgMember.organization_id} has ${pipelineCountBefore} pipelines before safety net`);

    let createdDefaults = false;
    let pipelineCountAfter = pipelineCountBefore;

    if (!pipelinesError && pipelineCountBefore === 0) {
      console.log('Organization has no flows, creating defaults via RPC:', orgMember.organization_id);
      
      const { error: createError } = await supabaseAdmin.rpc('create_default_pipelines', {
        org_id: orgMember.organization_id
      });
      
      if (createError) {
        console.error('RPC Error creating default pipelines:', createError);
      } else {
        console.log('RPC call completed, verifying pipeline creation...');
        
        // Verify pipelines were actually created
        const { data: pipelinesAfter } = await supabaseAdmin
          .from('pipelines')
          .select('id')
          .eq('organization_id', orgMember.organization_id);
        
        pipelineCountAfter = pipelinesAfter?.length || 0;
        console.log(`Organization ${orgMember.organization_id} now has ${pipelineCountAfter} pipelines`);
        
        if (pipelineCountAfter > 0) {
          createdDefaults = true;
          console.log('✅ Successfully verified default flows creation');
        } else {
          console.error('❌ WARNING: RPC succeeded but no pipelines found! This should not happen.');
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        pipelinesBefore: pipelineCountBefore,
        pipelinesAfter: pipelineCountAfter,
        createdDefaults
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in track-login function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

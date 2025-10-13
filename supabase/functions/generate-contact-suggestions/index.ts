import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId } = await req.json();
    
    if (!contactId) {
      return new Response(
        JSON.stringify({ error: 'contactId is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch contact basic info
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('name, status, created_at')
      .eq('id', contactId)
      .single();

    if (contactError) throw contactError;

    // Fetch tags
    const { data: tags } = await supabase
      .from('contact_tags')
      .select('tag')
      .eq('contact_id', contactId);

    // Fetch recent interactions (last 10)
    const { data: interactions } = await supabase
      .from('contact_interactions')
      .select('interaction_type, subject, details, completed_at, created_at')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch active prayer requests
    const { data: prayerRequests } = await supabase
      .from('contact_prayer_requests')
      .select('title, description, status, created_at')
      .eq('contact_id', contactId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    // Fetch demographics for birthday info
    const { data: demographics } = await supabase
      .from('contact_demographics')
      .select('birthday')
      .eq('contact_id', contactId)
      .maybeSingle();

    // Fetch pipeline information
    const { data: pipelineContacts } = await supabase
      .from('pipeline_contacts')
      .select(`
        created_at,
        pipelines(name),
        pipeline_stages(name)
      `)
      .eq('contact_id', contactId);

    // Calculate last interaction date
    const lastInteraction = interactions?.[0];
    const daysSinceLastContact = lastInteraction 
      ? Math.floor((Date.now() - new Date(lastInteraction.completed_at || lastInteraction.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Check birthday proximity
    let birthdayInfo = null;
    if (demographics?.birthday) {
      const birthday = new Date(demographics.birthday);
      const today = new Date();
      const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
      const daysUntilBirthday = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilBirthday >= 0 && daysUntilBirthday <= 30) {
        birthdayInfo = { daysUntil: daysUntilBirthday, date: thisYearBirthday.toLocaleDateString() };
      }
    }

    // Build AI prompt
    const systemPrompt = `You are a pastoral care assistant analyzing contact engagement data to suggest next steps.

Focus on:
- Follow-up timing (suggest if no contact in 14+ days)
- Prayer request check-ins (active requests older than 7 days)
- Upcoming birthdays (within 30 days)
- Pipeline progression issues (stalled contacts)
- Relationship building opportunities

Return 3-5 prioritized, actionable suggestions.`;

    const userPrompt = `Contact: ${contact.name}
Status: ${contact.status}
Tags: ${tags?.map(t => t.tag).join(', ') || 'None'}
Days Since Last Contact: ${daysSinceLastContact !== null ? daysSinceLastContact : 'Never contacted'}

Recent Interactions:
${interactions?.slice(0, 5).map(i => `- ${i.interaction_type}: ${i.subject} (${Math.floor((Date.now() - new Date(i.completed_at || i.created_at).getTime()) / (1000 * 60 * 60 * 24))} days ago)`).join('\n') || 'No recent interactions'}

Active Prayer Requests:
${prayerRequests?.map(pr => `- ${pr.title} (${Math.floor((Date.now() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60 * 24))} days old)`).join('\n') || 'None'}

${birthdayInfo ? `Birthday Coming Up: In ${birthdayInfo.daysUntil} days (${birthdayInfo.date})` : ''}

Current Pipelines:
${pipelineContacts?.map(pc => `- ${pc.pipelines.name}: ${pc.pipeline_stages.name} (${Math.floor((Date.now() - new Date(pc.created_at).getTime()) / (1000 * 60 * 60 * 24))} days in stage)`).join('\n') || 'Not in any pipeline'}`;

    console.log('Calling Lovable AI with prompt:', { systemPrompt, userPrompt });

    // Call Lovable AI with tool calling
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_contact_actions',
              description: 'Return 3-5 prioritized suggestions for contact engagement',
              parameters: {
                type: 'object',
                properties: {
                  suggestions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { 
                          type: 'string', 
                          enum: ['follow_up', 'prayer_check', 'birthday', 'next_step', 'engagement', 'milestone']
                        },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        priority: { 
                          type: 'string', 
                          enum: ['low', 'medium', 'high'] 
                        },
                        actionText: { type: 'string' }
                      },
                      required: ['type', 'title', 'description', 'priority'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['suggestions'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_contact_actions' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('AI Response:', JSON.stringify(aiResponse, null, 2));

    // Extract suggestions from tool call
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const suggestions = JSON.parse(toolCall.function.arguments).suggestions;

    return new Response(
      JSON.stringify({ suggestions }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-contact-suggestions:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [] // Return empty array as fallback
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

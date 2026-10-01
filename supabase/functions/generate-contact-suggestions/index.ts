import { createClient } from "@supabase/supabase-js";
import { getGlooAccessToken } from "../_shared/gloo.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch contact basic info
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('name, status, created_at, organization_id')
      .eq('id', contactId)
      .single();

    if (contactError) throw contactError;

    // Phase 3A: Fetch feedback patterns for this organization (last 30 days)
    const { data: feedbackStats } = await supabase
      .from('ai_suggestion_feedback')
      .select('suggestion_type, feedback_type, action_taken')
      .eq('organization_id', contact.organization_id)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // Aggregate feedback patterns
    const feedbackPatterns: Record<string, { positive: number; negative: number; actions: string[] }> = {};
    feedbackStats?.forEach(fb => {
      if (!feedbackPatterns[fb.suggestion_type]) {
        feedbackPatterns[fb.suggestion_type] = { positive: 0, negative: 0, actions: [] };
      }
      if (fb.feedback_type === 'positive') feedbackPatterns[fb.suggestion_type].positive++;
      if (fb.feedback_type === 'negative') feedbackPatterns[fb.suggestion_type].negative++;
      if (fb.action_taken) feedbackPatterns[fb.suggestion_type].actions.push(fb.action_taken);
    });

    // Fetch tags
    const { data: tags } = await supabase
      .from('contact_tags')
      .select('tag')
      .eq('contact_id', contactId);

    // Fetch all flow moment types for the organization
    const { data: allMomentTypes } = await supabase
      .from('flow_moment_types')
      .select('id, name, category, description')
      .eq('organization_id', contact.organization_id)
      .eq('is_active', true)
      .order('category', { ascending: true });

    // Fetch contact's completed flow moments
    const { data: contactMoments } = await supabase
      .from('flow_moments')
      .select(`
        id,
        occurred_at,
        flow_moment_type_id,
        flow_moment_types(name, category)
      `)
      .eq('contact_id', contactId);

    // Fetch recent interactions (last 10)
    const { data: interactions } = await supabase
      .from('contact_interactions')
      .select('interaction_type, subject, details, completed_at, created_at, created_by_user_id')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Phase 3A: Fetch recent team activity on this contact (last 7 days, excluding current user)
    const { data: recentTeamActivity } = await supabase
      .from('contact_interactions')
      .select('interaction_type, subject, created_at')
      .eq('contact_id', contactId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

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

    // Fetch pipeline information with descriptions and stage details
    const { data: pipelineContacts } = await supabase
      .from('pipeline_contacts')
      .select(`
        created_at,
        stage_order,
        pipelines(
          name, 
          description,
          id
        ),
        pipeline_stages(
          name,
          stage_order,
          is_start_step,
          is_end_step
        )
      `)
      .eq('contact_id', contactId);

    // Fetch all stages for each pipeline to show full flow structure
    const pipelineIds = [...new Set(pipelineContacts?.map(pc => pc.pipelines.id) || [])];
    const { data: allStages } = await supabase
      .from('pipeline_stages')
      .select('id, pipeline_id, name, stage_order, is_start_step, is_end_step')
      .in('pipeline_id', pipelineIds)
      .order('stage_order', { ascending: true });

    // Phase 3A: Get organization-wide benchmarks (average time in each stage)
    let orgBenchmarks: Record<string, { avgDays: number; stageName: string }> = {};
    if (pipelineIds.length > 0) {
      const { data: benchmarkData } = await supabase
        .from('pipeline_contacts')
        .select('stage_id, created_at, updated_at, pipeline_stages!pipeline_contacts_stage_id_fkey(name)')
        .in('pipeline_id', pipelineIds)
        .not('stage_id', 'is', null);

      if (benchmarkData && benchmarkData.length > 0) {
        const stageStats: Record<string, { totalDays: number; count: number; name: string }> = {};
        benchmarkData.forEach(pc => {
          const stageId = pc.stage_id;
          if (stageId && pc.pipeline_stages) {
            if (!stageStats[stageId]) {
              stageStats[stageId] = { totalDays: 0, count: 0, name: pc.pipeline_stages.name };
            }
            const days = (new Date(pc.updated_at).getTime() - new Date(pc.created_at).getTime()) / (1000 * 60 * 60 * 24);
            stageStats[stageId].totalDays += days;
            stageStats[stageId].count++;
          }
        });
        Object.entries(stageStats).forEach(([stageId, stats]) => {
          orgBenchmarks[stageId] = {
            avgDays: Math.round(stats.totalDays / stats.count),
            stageName: stats.name
          };
        });
      }
    }

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

    // Build feedback context for AI prompt
    let feedbackContext = '';
    if (Object.keys(feedbackPatterns).length > 0) {
      feedbackContext = '\n\nLEARNED PREFERENCES (based on your team\'s feedback over last 30 days):\n';
      Object.entries(feedbackPatterns).forEach(([type, stats]) => {
        const total = stats.positive + stats.negative;
        const helpfulRate = total > 0 ? Math.round((stats.positive / total) * 100) : 0;
        const actionRate = stats.actions.length > 0 ? Math.round((stats.actions.length / total) * 100) : 0;
        feedbackContext += `- ${type}: ${helpfulRate}% helpful (${total} feedback), ${actionRate}% acted upon\n`;
      });
      feedbackContext += 'IMPORTANT: Prioritize suggestion types that have been most helpful to this team.\n';
    }

    // Build team activity context
    let teamActivityContext = '';
    if (recentTeamActivity && recentTeamActivity.length > 0) {
      teamActivityContext = '\n\nRECENT TEAM ACTIVITY (last 7 days):\n';
      recentTeamActivity.forEach(activity => {
        const daysAgo = Math.floor((Date.now() - new Date(activity.created_at).getTime()) / (1000 * 60 * 60 * 24));
        teamActivityContext += `- ${activity.interaction_type}${activity.subject ? `: ${activity.subject}` : ''} (${daysAgo} days ago)\n`;
      });
      teamActivityContext += 'IMPORTANT: If a team member just interacted, suggest coordination rather than duplicate outreach.\n';
    }

    // Build benchmarks context
    let benchmarksContext = '';
    const currentPipelineContact = pipelineContacts?.[0];
    if (Object.keys(orgBenchmarks).length > 0 && currentPipelineContact) {
      const currentStageId = currentPipelineContact.pipeline_stages?.stage_order;
      const currentStageBenchmark = currentStageId !== undefined ? orgBenchmarks[currentStageId] : null;
      
      if (currentStageBenchmark) {
        const daysInCurrentStage = Math.floor((Date.now() - new Date(currentPipelineContact.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const avgDays = currentStageBenchmark.avgDays;
        benchmarksContext = '\n\nORGANIZATION BENCHMARKS:\n';
        benchmarksContext += `- Average time in "${currentStageBenchmark.stageName}" stage: ${avgDays} days (this contact: ${daysInCurrentStage} days`;
        if (daysInCurrentStage > avgDays * 1.5) {
          benchmarksContext += ' - STALLED!';
        } else if (daysInCurrentStage <= avgDays) {
          benchmarksContext += ' - on track';
        }
        benchmarksContext += ')\n';
        benchmarksContext += 'IMPORTANT: Flag contacts that are significantly slower than org averages.\n';
      }
    }

    // Build spiritual journey context (flow moments)
    let spiritualJourneyContext = '';
    if (allMomentTypes && allMomentTypes.length > 0) {
      spiritualJourneyContext = '\n\nSPIRITUAL JOURNEY MILESTONES:\n';
      
      // Group by category
      const categories = ['salvation', 'next_step', 'serving', 'group', 'other'];
      const completedMomentIds = new Set(contactMoments?.map(m => m.flow_moment_type_id) || []);
      
      categories.forEach(category => {
        const categoryMoments = allMomentTypes.filter(mt => mt.category === category);
        if (categoryMoments.length === 0) return;
        
        spiritualJourneyContext += `\n${category.toUpperCase()}:\n`;
        categoryMoments.forEach(mt => {
          const completed = completedMomentIds.has(mt.id);
          const moment = contactMoments?.find(m => m.flow_moment_type_id === mt.id);
          const date = moment ? new Date(moment.occurred_at).toLocaleDateString() : '';
          spiritualJourneyContext += `  ${completed ? '✅' : '❌'} ${mt.name}${completed ? ` (${date})` : ''}\n`;
        });
      });
      
      spiritualJourneyContext += '\nIMPORTANT: Use this spiritual journey data to suggest appropriate next steps. For example:\n';
      spiritualJourneyContext += '- If salvation is complete but not baptism, suggest baptism discussion\n';
      spiritualJourneyContext += '- If serving but not in a small group, suggest group connection\n';
      spiritualJourneyContext += '- If no leadership training but actively serving, suggest leadership development\n';
      spiritualJourneyContext += '- Consider the timing of completed moments for follow-up opportunities\n';
    }

    // Build AI prompt with enhanced flow context
    const systemPrompt = `You are a pastoral care assistant analyzing contact engagement data to suggest next steps.

Focus on:
- Follow-up timing (suggest if no contact in 14+ days)
- Prayer request check-ins (active requests older than 7 days)
- Upcoming birthdays (within 30 days)
- Pipeline progression issues (stalled contacts)
- Stage-specific recommendations based on flow purpose
- Relationship building opportunities
${feedbackContext}${teamActivityContext}${benchmarksContext}${spiritualJourneyContext}
IMPORTANT:
- Consider the flow description to understand the ministry context
- Use stage sequence to suggest appropriate next steps
- Identify if contact is stalled (too long in one stage without progression)
- Recommend stage progression when appropriate
- Give context-aware advice that aligns with the flow's purpose

REASONING FIELD:
- Always include a brief, specific reasoning for each suggestion
- Examples: "No contact in 18 days", "Birthday in 5 days", "Prayer request is 12 days old", "Stalled in Welcome stage for 23 days"
- Keep reasoning concise (under 50 characters)

MESSAGE CAPABILITY:
- When suggesting text messages, emails, or thank-you notes, set requiresMessage: true and specify messageType
- Examples:
  * "Send Thank-you Text" → requiresMessage: true, messageType: "text"
  * "Follow-up Email" → requiresMessage: true, messageType: "email"
  * "Check in via text" → requiresMessage: true, messageType: "text"
  * "Schedule Call" → requiresMessage: false (no message content needed)
  * "Update stage" → requiresMessage: false (action-based, not message-based)

STAGE PROGRESSION:
- When suggesting stage progression (type: 'stage_action'):
  * ALWAYS include suggestedStageId (the exact stage.id from the database)
  * ALWAYS include suggestedStageName (the human-readable stage name)
  * ALWAYS include pipelineId (the pipeline.id this stage belongs to)
  * Set actionText to describe the action (e.g., "Move to Thank You Text")
  * Explain why this progression makes sense in the description
  * Use the stage IDs provided in the Stage Progression section

Return 3-5 prioritized, actionable suggestions.`;

    // Build enriched pipeline context
    const pipelineContexts = pipelineIds.map(pipelineId => {
      const contact = pipelineContacts?.find(pc => pc.pipelines.id === pipelineId);
      if (!contact) return '';
      
      const stages = allStages?.filter(s => s.pipeline_id === pipelineId) || [];
      const currentStage = contact.pipeline_stages;
      
      const stageSequence = stages
        .map(s => {
          const marker = s.is_start_step ? '→ START' : s.is_end_step ? '→ END' : '';
          const current = s.stage_order === currentStage?.stage_order ? '**[CURRENT]**' : '';
          return `  ${s.stage_order + 1}. ${s.name} (ID: ${s.id}) ${marker} ${current}`.trim();
        })
        .join('\n');
      
      const daysInStage = Math.floor((Date.now() - new Date(contact.created_at).getTime()) / (1000 * 60 * 60 * 24));
      
      return `
Flow: ${contact.pipelines.name} (Pipeline ID: ${contact.pipelines.id})
${contact.pipelines.description ? `Purpose: ${contact.pipelines.description}` : 'Purpose: Not specified'}
Current Stage: ${currentStage.name} (${daysInStage} days in this stage)
Stage Progression:
${stageSequence}`;
    }).filter(Boolean).join('\n\n---\n\n');

    const userPrompt = `Contact: ${contact.name}
Status: ${contact.status}
Tags: ${tags?.map(t => t.tag).join(', ') || 'None'}
Days Since Last Contact: ${daysSinceLastContact !== null ? daysSinceLastContact : 'Never contacted'}

Recent Interactions:
${interactions?.slice(0, 5).map(i => `- ${i.interaction_type}: ${i.subject} (${Math.floor((Date.now() - new Date(i.completed_at || i.created_at).getTime()) / (1000 * 60 * 60 * 24))} days ago)`).join('\n') || 'No recent interactions'}

Active Prayer Requests:
${prayerRequests?.map(pr => `- ${pr.title} (${Math.floor((Date.now() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60 * 24))} days old)`).join('\n') || 'None'}

${birthdayInfo ? `Birthday Coming Up: In ${birthdayInfo.daysUntil} days (${birthdayInfo.date})\n` : ''}

Current Pipeline Assignments:
${pipelineContexts || 'Not in any pipeline'}`;

    console.log('Calling Lovable AI with prompt:', { systemPrompt, userPrompt });

    // Call Lovable AI with tool calling
    const response = await fetch('https://platform.ai.gloo.com/ai/v2/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getGlooAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gloo-google-gemini-3-flash',
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
                          enum: ['follow_up', 'prayer_check', 'birthday', 'next_step', 'engagement', 'milestone', 'stage_action']
                        },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        reasoning: { 
                          type: 'string',
                          description: 'Brief explanation of why this suggestion is being made (e.g., "No contact in 18 days" or "Birthday in 5 days")'
                        },
                        priority: { 
                          type: 'string', 
                          enum: ['low', 'medium', 'high'] 
                        },
                        actionText: { type: 'string' },
                        requiresMessage: { type: 'boolean' },
                        messageType: { 
                          type: 'string',
                          enum: ['text', 'email']
                        },
                        suggestedStageId: { type: 'string' },
                        suggestedStageName: { type: 'string' },
                        pipelineId: { type: 'string' }
                      },
                      required: ['type', 'title', 'description', 'reasoning', 'priority'],
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

    // Track AI usage
    try {
      await supabase.rpc('increment_ai_stat', {
        org_id: contact.organization_id,
        stat_column: 'ai_suggestions_used'
      });
    } catch (trackError) {
      console.error('Failed to track AI usage:', trackError);
      // Don't fail the request, just log
    }

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

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
    const { groupName, groupType, meetingDay, meetingFrequency, location, currentDescription = "", organizationId } = await req.json();

    if (!groupName) {
      return new Response(
        JSON.stringify({ error: "Group name is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "Organization ID is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const groupTypeLabels: Record<string, string> = {
      small_group: "Small Group",
      serving_team: "Serving Team",
      class: "Class",
      ministry: "Ministry",
    };

    const contextParts = [
      `Group Name: ${groupName}`,
      `Group Type: ${groupTypeLabels[groupType] || groupType || "Not specified"}`,
      meetingDay ? `Meeting Day: ${meetingDay}` : null,
      meetingFrequency ? `Meeting Frequency: ${meetingFrequency}` : null,
      location ? `Location: ${location}` : null,
    ].filter(Boolean).join('\n');

    const systemPrompt = `You are a ministry operations assistant helping create group descriptions for a church management system. Your descriptions should be welcoming, clear, and ministry-appropriate.`;

    const userPrompt = `${contextParts}
${currentDescription ? `User's Starting Point: "${currentDescription}"` : 'Current Description: None'}

${currentDescription 
  ? `The user has already started writing a description. Your task is to:
- EXPAND and REFINE their ideas into complete, polished descriptions
- PRESERVE the core intent and tone they've started with
- ADD welcoming, community-focused details
- BUILD UPON their starting points rather than replacing them

Create 3 versions that elaborate on their idea with different tones (professional, friendly, concise).`
  : `Based on this information, suggest 3 clear, welcoming group descriptions that:
- Explain the purpose and goal of this group
- Describe who this group is for
- Convey a sense of community and belonging
- Use ministry-appropriate, welcoming language
- Are between 30-100 words

Provide options with different tones:
1. Professional (formal, detailed, ministry-focused)
2. Friendly (warm, welcoming, conversational)
3. Concise (brief, action-oriented, to-the-point)`}`;

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
            type: "function",
            function: {
              name: "suggest_group_descriptions",
              description: "Generate 3 group description options with different tones",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tone: { type: "string", enum: ["professional", "friendly", "concise"] },
                        description: { type: "string" },
                        wordCount: { type: "number" }
                      },
                      required: ["tone", "description", "wordCount"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["suggestions"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "suggest_group_descriptions" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add funds to your workspace." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to generate suggestions" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'suggest_group_descriptions') {
      return new Response(
        JSON.stringify({ error: "Invalid AI response" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const suggestions = JSON.parse(toolCall.function.arguments);

    try {
      await supabase.rpc('increment_ai_stat', {
        org_id: organizationId,
        stat_column: 'ai_descriptions_generated'
      });
    } catch (trackError) {
      console.error('Failed to track AI usage:', trackError);
    }

    return new Response(
      JSON.stringify(suggestions),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-group-description function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

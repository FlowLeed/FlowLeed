import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { flowName, flowStages = [], currentDescription = "", organizationId } = await req.json();

    if (!flowName) {
      return new Response(
        JSON.stringify({ error: "Flow name is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "Organization ID is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build stage progression string
    const stageProgression = flowStages.length > 0 
      ? flowStages.map((s: any) => s.name).join(' → ')
      : "No stages defined yet";

    // Build the AI prompt
    const systemPrompt = `You are a ministry operations assistant helping create flow descriptions for church management systems. Your descriptions should be clear, actionable, and ministry-appropriate.`;

    const userPrompt = `Flow Name: ${flowName}
Stage Progression: ${stageProgression}
${currentDescription ? `User's Starting Point: "${currentDescription}"` : 'Current Description: None'}

${currentDescription 
  ? `The user has already started writing a description. Your task is to:
- EXPAND and REFINE their ideas into complete, polished descriptions
- PRESERVE the core intent and tone they've started with
- ADD ministry-appropriate details, structure, and clarity
- BUILD UPON their starting points rather than replacing them

Create 3 versions that elaborate on their idea with different tones (professional, friendly, concise).`
  : `Based on this information, suggest 2-3 clear, actionable flow descriptions that:
- Explain the purpose and goal of this flow
- Describe who this flow is for
- Outline the expected journey through the stages
- Use ministry-appropriate language
- Are between 50-150 words

Provide options with different tones:
1. Professional (formal, detailed, ministry-focused)
2. Friendly (warm, welcoming, conversational)
3. Concise (brief, action-oriented, to-the-point)`}`;

    console.log('Generating flow descriptions for:', flowName);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
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
            type: "function",
            function: {
              name: "suggest_flow_descriptions",
              description: "Generate 2-3 flow description options with different tones",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tone: { 
                          type: "string", 
                          enum: ["professional", "friendly", "concise"]
                        },
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
        tool_choice: { type: "function", function: { name: "suggest_flow_descriptions" } }
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
    console.log('AI response received');

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'suggest_flow_descriptions') {
      console.error('Unexpected AI response format');
      return new Response(
        JSON.stringify({ error: "Invalid AI response" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const suggestions = JSON.parse(toolCall.function.arguments);
    
    // Track AI usage
    try {
      await supabase.rpc('increment_ai_stat', {
        org_id: organizationId,
        stat_column: 'ai_descriptions_generated'
      });
    } catch (trackError) {
      console.error('Failed to track AI usage:', trackError);
      // Don't fail the request, just log
    }

    return new Response(
      JSON.stringify(suggestions),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-flow-description function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

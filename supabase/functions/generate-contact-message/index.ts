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
    const { contactId, messageType, suggestionContext } = await req.json();
    
    if (!contactId || !messageType || !suggestionContext) {
      return new Response(
        JSON.stringify({ error: 'contactId, messageType, and suggestionContext are required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    // (Gloo auth handled in getGlooAccessToken)

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch contact details
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('name, status, created_at, phone, email, organization_id')
      .eq('id', contactId)
      .single();

    if (contactError) throw contactError;

    // Fetch recent interactions for context
    const { data: interactions } = await supabase
      .from('contact_interactions')
      .select('interaction_type, subject, details, completed_at')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Fetch active prayer requests
    const { data: prayerRequests } = await supabase
      .from('contact_prayer_requests')
      .select('title, description')
      .eq('contact_id', contactId)
      .eq('status', 'active')
      .limit(3);

    // Fetch tags for relationship context
    const { data: tags } = await supabase
      .from('contact_tags')
      .select('tag')
      .eq('contact_id', contactId);

    // Build context-rich prompt
    const systemPrompt = `You are a pastoral care assistant writing a warm, personal message for church staff.

Guidelines for ${messageType === 'text' ? 'text messages' : 'emails'}:
- Keep it concise and natural (${messageType === 'text' ? '1-3 sentences for texts' : '2-4 sentences for emails'})
- Use first person (from church staff/volunteer perspective)
- Be warm but professional
- Reference specific context when appropriate
- End with clear next step or open question when relevant
- Match the tone to the relationship (new contact vs established)
- ${messageType === 'text' ? 'Use conversational language suitable for SMS' : 'Use slightly more formal language for email'}
- ${messageType === 'text' ? 'Can use appropriate emojis sparingly (1-2 max)' : 'Avoid emojis in emails'}

Context for this message:
${suggestionContext.description}

Write a message that feels personal, not templated.`;

    const userPrompt = `Contact: ${contact.name}
Status: ${contact.status}
Tags: ${tags?.map(t => t.tag).join(', ') || 'None'}
Days as contact: ${Math.floor((Date.now() - new Date(contact.created_at).getTime()) / (1000 * 60 * 60 * 24))}

Recent Interactions:
${interactions?.map(i => `- ${i.interaction_type}: ${i.subject}`).join('\n') || 'No recent interactions'}

${prayerRequests && prayerRequests.length > 0 ? `Active Prayer Requests:\n${prayerRequests.map(pr => `- ${pr.title}`).join('\n')}` : ''}

Generate a ${messageType} message for: ${suggestionContext.title}
Context: ${suggestionContext.description}`;

    console.log('Calling Lovable AI to generate message');

    // Call Lovable AI
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
              name: 'generate_message',
              description: 'Generate a personalized message for the contact',
              parameters: {
                type: 'object',
                properties: {
                  message: { 
                    type: 'string',
                    description: 'The generated message text'
                  },
                  tone: {
                    type: 'string',
                    enum: ['warm', 'formal', 'casual', 'encouraging'],
                    description: 'The tone of the message'
                  }
                },
                required: ['message'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_message' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('AI Response received');

    // Extract message from tool call
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const { message, tone } = JSON.parse(toolCall.function.arguments);

    // Track AI usage
    try {
      await supabase.rpc('increment_ai_stat', {
        org_id: contact.organization_id,
        stat_column: 'ai_messages_generated'
      });
    } catch (trackError) {
      console.error('Failed to track AI usage:', trackError);
      // Don't fail the request, just log
    }

    return new Response(
      JSON.stringify({ message, tone }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-contact-message:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

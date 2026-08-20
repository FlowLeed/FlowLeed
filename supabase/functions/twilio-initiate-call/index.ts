import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'
import { corsHeaders } from '../_shared/cors.ts'

const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { contactId, fromNumberId } = await req.json()

    console.log('Initiating call to contact:', contactId)

    // Get user's organization
    const { data: membership } = await supabaseClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) throw new Error('User not in organization')

    // Get contact info
    const { data: contact } = await supabaseClient
      .from('contacts')
      .select('phone, organization_id, is_demo')
      .eq('id', contactId)
      .single()

    if (!contact || !contact.phone) {
      throw new Error('Contact has no phone number')
    }

    // Guardrail: never place real outbound traffic against sample (demo) people.
    if (contact.is_demo) {
      throw new Error('This is sample data — outbound messages and calls are disabled for sample people.')
    }

    // Determine which number to use
    let fromNumber
    if (fromNumberId) {
      const { data: phoneNumber } = await supabaseClient
        .from('twilio_phone_numbers')
        .select('*')
        .eq('id', fromNumberId)
        .eq('organization_id', membership.organization_id)
        .single()
      fromNumber = phoneNumber
    } else {
      // Use user's assigned number or org primary
      const { data: userNumber } = await supabaseClient
        .from('twilio_phone_numbers')
        .select('*')
        .eq('assigned_to_user_id', user.id)
        .eq('organization_id', membership.organization_id)
        .eq('status', 'active')
        .maybeSingle()

      if (userNumber) {
        fromNumber = userNumber
      } else {
        const { data: primaryNumber } = await supabaseClient
          .from('twilio_phone_numbers')
          .select('*')
          .eq('organization_id', membership.organization_id)
          .eq('is_primary', true)
          .eq('status', 'active')
          .single()
        fromNumber = primaryNumber
      }
    }

    if (!fromNumber) {
      throw new Error('No phone number available to call from')
    }

    console.log('Initiating call via Twilio from:', fromNumber.phone_number)

    // Initiate call via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`
    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: contact.phone,
        From: fromNumber.phone_number,
        Url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-webhook-voice`,
        StatusCallback: `${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-webhook-status`,
        StatusCallbackEvent: 'initiated,ringing,answered,completed',
        Record: 'true'
      })
    })

    const twilioData = await twilioResponse.json()
    if (twilioResponse.status !== 201) {
      throw new Error(twilioData.message || 'Failed to initiate call')
    }

    console.log('Call initiated, storing in database')

    // Store in database
    const { data: call, error: dbError } = await supabaseClient
      .from('call_records')
      .insert({
        organization_id: membership.organization_id,
        contact_id: contactId,
        twilio_call_sid: twilioData.sid,
        from_number: fromNumber.phone_number,
        to_number: contact.phone,
        direction: 'outbound',
        status: twilioData.status,
        call_type: 'outbound',
        twilio_phone_number_id: fromNumber.id,
        initiated_by_user_id: user.id
      })
      .select()
      .single()

    if (dbError) throw dbError

    console.log('Call initiated successfully')

    return new Response(
      JSON.stringify({ success: true, data: call }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})